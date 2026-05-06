import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseIdsBody, requireMember, writeAuditLog } from "@/lib/issues/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bulk-assign a `product_category_id` to the selected sales rows. Sets
 * `classification_source = 'manual'` so it's clear these were not auto-
 * classified by a rule.
 *
 * Body: { ids: string[], category_id: string }
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

  const ids = parseIdsBody(body);
  if (!ids) {
    return NextResponse.json(
      { error: "Thiếu danh sách dòng" },
      { status: 400 }
    );
  }

  const categoryId = String(
    (body as { category_id?: unknown }).category_id ?? ""
  );
  if (!categoryId) {
    return NextResponse.json(
      { error: "Thiếu category_id" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verify the category belongs to this store.
  const { data: cat } = await admin
    .from("product_categories")
    .select("id, name, code")
    .eq("id", categoryId)
    .eq("store_id", auth.profile.store_id)
    .maybeSingle();
  if (!cat) {
    return NextResponse.json(
      { error: "Nhóm sản phẩm không hợp lệ" },
      { status: 400 }
    );
  }

  const { error: updateErr, data: after } = await admin
    .from("sales_transactions")
    .update({
      product_category_id: categoryId,
      classification_source: "manual",
    })
    .eq("store_id", auth.profile.store_id)
    .in("id", ids)
    .select("id, product_category_id, classification_source");

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "issue_assign_category",
    entity_type: "sales_transactions",
    entity_id: ids.length === 1 ? ids[0] : null,
    metadata: {
      ids,
      count: ids.length,
      category_id: categoryId,
      category_name: cat.name,
      category_code: cat.code,
    },
    diff: { after: after ?? [] },
  });

  return NextResponse.json({ updated: after?.length ?? 0 });
}
