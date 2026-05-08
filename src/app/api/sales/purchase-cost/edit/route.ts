import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/issues/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\./g, "").replace(/,/g, ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Manually edit purchase cost for a sales transaction.
 * Body: { id: string, purchase_cost_amount: string | number, reason: string }
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const id = String((body as { id?: unknown }).id ?? "").trim();
  const reason = String((body as { reason?: unknown }).reason ?? "").trim();
  const amount = parseMoney((body as { purchase_cost_amount?: unknown }).purchase_cost_amount);

  if (!id) {
    return NextResponse.json({ error: "Thiếu giao dịch cần chỉnh sửa" }, { status: 400 });
  }
  if (amount === null || amount < 0) {
    return NextResponse.json({ error: "Giá mua vào không hợp lệ" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Cần nhập lý do chỉnh sửa" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: before, error: beforeErr } = await admin
    .from("sales_transactions")
    .select("id, store_id, total_amount, purchase_cost_amount, purchase_cost_source, tax_calculation_status, value_added_amount")
    .eq("id", id)
    .eq("store_id", auth.profile.store_id)
    .maybeSingle();

  if (beforeErr) {
    return NextResponse.json({ error: beforeErr.message }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ error: "Không tìm thấy giao dịch" }, { status: 404 });
  }

  const valueAdded = Number(before.total_amount ?? 0) - amount;
  const now = new Date().toISOString();

  const { data: after, error: updateErr } = await admin
    .from("sales_transactions")
    .update({
      purchase_cost_amount: amount,
      purchase_cost_source: "manual",
      value_added_amount: valueAdded,
      tax_calculation_status: "complete",
      purchase_cost_edited_at: now,
      purchase_cost_edited_by: auth.profile.id,
      purchase_cost_edit_reason: reason,
    })
    .eq("id", id)
    .eq("store_id", auth.profile.store_id)
    .select("id, purchase_cost_amount, purchase_cost_source, tax_calculation_status, value_added_amount, purchase_cost_edited_at, purchase_cost_edit_reason")
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "sales_purchase_cost_edit",
    entity_type: "sales_transactions",
    entity_id: id,
    metadata: { reason },
    diff: { before, after },
  });

  return NextResponse.json({ updated: 1, row: after });
}
