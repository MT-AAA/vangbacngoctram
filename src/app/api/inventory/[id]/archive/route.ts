import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/inventory/api";
import { inventoryArchiveSchema } from "@/lib/inventory/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Soft-archive an inventory item. Only `admin` can archive (Phase 2G spec
 * keeps accountants/staff away from destructive ops).
 *
 * Sets status='archived', records `archived_at`, `archived_by`,
 * `archived_reason`. The DB trigger backfills `archived_at` if missing.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = inventoryArchiveSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("inventory_items")
    .select("id, sku, name, status")
    .eq("id", params.id)
    .eq("store_id", auth.profile.store_id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }
  if (existing.status === "archived") {
    return NextResponse.json(
      { error: "Mặt hàng đã được lưu trữ" },
      { status: 409 }
    );
  }

  const { data: after, error: updateErr } = await admin
    .from("inventory_items")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      archived_by: auth.profile.id,
      archived_reason: parsed.data.reason,
    })
    .eq("id", params.id)
    .eq("store_id", auth.profile.store_id)
    .select("*")
    .single();

  if (updateErr || !after) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Không lưu trữ được" },
      { status: 500 }
    );
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "archive_inventory_item",
    entity_type: "inventory_items",
    entity_id: after.id,
    metadata: {
      sku: after.sku,
      name: after.name,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({ item: after });
}
