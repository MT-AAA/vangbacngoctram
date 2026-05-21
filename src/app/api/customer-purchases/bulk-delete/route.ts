import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/customer-purchases/api";
import { removeInventoryLink } from "@/lib/customer-purchases/inventory";
import { recalculateInventorySalesFromPurchase } from "@/lib/inventory/recalculate-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids)
    ? Array.from(
        new Set(body.ids.filter((id: unknown): id is string => typeof id === "string"))
      )
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Chưa chọn giao dịch để xóa" }, { status: 400 });
  }

  if (ids.length > 100) {
    return NextResponse.json(
      { error: "Chỉ được xóa tối đa 100 giao dịch mỗi lần" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: rows, error: fetchErr } = await admin
    .from("customer_purchases")
    .select("*")
    .eq("store_id", auth.profile.store_id)
    .in("id", ids);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy giao dịch" }, { status: 404 });
  }

  const recalcKeys = new Map<string, { productCategoryId: string; purchaseDate: string }>();
  const unlinkResults = [];

  for (const row of rows) {
    const unlinkResult = row.inventory_item_id
      ? await removeInventoryLink(admin, row.id, auth.profile.id)
      : {
          inventory_item_id: null,
          product_category_id: row.product_category_id,
          purchase_date: row.purchase_date,
        };

    unlinkResults.push({ id: row.id, ...unlinkResult });

    if (unlinkResult.product_category_id) {
      const key = `${unlinkResult.product_category_id}|${unlinkResult.purchase_date ?? row.purchase_date}`;
      recalcKeys.set(key, {
        productCategoryId: unlinkResult.product_category_id,
        purchaseDate: unlinkResult.purchase_date ?? row.purchase_date,
      });
    }
  }

  const { error: deleteErr } = await admin
    .from("customer_purchases")
    .delete()
    .eq("store_id", auth.profile.store_id)
    .in("id", rows.map((row) => row.id));

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  const recalcResults = [];
  for (const recalc of Array.from(recalcKeys.values())) {
    recalcResults.push(
      await recalculateInventorySalesFromPurchase(admin, {
        storeId: auth.profile.store_id,
        productCategoryId: recalc.productCategoryId,
        purchaseDate: recalc.purchaseDate,
        calculatedBy: auth.profile.id,
      })
    );
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "customer_purchase_bulk_delete",
    entity_type: "customer_purchases",
    entity_id: rows[0].id,
    diff: { before: rows },
    metadata: {
      requested_ids: ids,
      deleted_count: rows.length,
      unlink_results: unlinkResults,
      recalc_results: recalcResults,
    },
  });

  return NextResponse.json({ ok: true, deleted_count: rows.length });
}
