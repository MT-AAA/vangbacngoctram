import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/inventory/api";
import { inventoryBulkLinkSalesSchema } from "@/lib/inventory/bulk-schema";
import { calculateTimeBasedInventoryCost } from "@/lib/inventory/time-based-cost";
import { recalculateTaxPeriod, cascadeRecalculateYear } from "@/lib/tax/recalculate";
import { recordInventoryMovement } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin", "staff"]);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = inventoryBulkLinkSalesSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: inventory } = await admin
    .from("inventory_items")
    .select("id, product_category_id, store_id")
    .eq("id", input.inventory_item_id)
    .eq("store_id", auth.profile.store_id)
    .maybeSingle();

  if (!inventory) {
    return NextResponse.json({ error: "Không tìm thấy rổ tồn kho" }, { status: 404 });
  }

  const { data: sales, error: salesErr } = await admin
    .from("sales_transactions")
    .select("id, store_id, sale_date, quantity, weight, weight_unit, total_amount, purchase_cost_amount, value_added_amount, purchase_cost_source, product_category_id")
    .eq("store_id", auth.profile.store_id)
    .in("id", input.sale_ids)
    .order("sale_date", { ascending: true });

  if (salesErr) return NextResponse.json({ error: salesErr.message }, { status: 500 });

  const updated: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const affectedPeriods = new Set<string>();

  for (const sale of sales ?? []) {
    if (sale.purchase_cost_source === "manual" && !input.override_manual_cost) {
      skipped.push({ id: sale.id, reason: "Đã có giá vốn nhập tay" });
      continue;
    }
    if (!sale.product_category_id) {
      skipped.push({ id: sale.id, reason: "Chưa phân loại nhóm hàng" });
      continue;
    }

    const { data: period } = await admin
      .from("tax_periods")
      .select("id, is_locked")
      .eq("store_id", auth.profile.store_id)
      .lte("start_date", sale.sale_date)
      .gte("end_date", sale.sale_date)
      .maybeSingle();

    if (period?.is_locked) {
      skipped.push({ id: sale.id, reason: "Kỳ thuế đã khóa" });
      continue;
    }

    try {
      const cost = await calculateTimeBasedInventoryCost(admin, {
        storeId: auth.profile.store_id,
        categoryId: sale.product_category_id,
        saleDate: sale.sale_date,
        saleWeight: sale.weight === null ? null : Number(sale.weight),
        saleWeightUnit: sale.weight_unit,
        saleQuantity: Number(sale.quantity ?? 0),
        excludeSaleId: sale.id,
      });

      const newValueAdded = Number(sale.total_amount ?? 0) - cost.sale_cost;
      const { error: updateErr } = await admin
        .from("sales_transactions")
        .update({
          linked_inventory_item_id: input.inventory_item_id,
          purchase_cost_amount: cost.sale_cost,
          purchase_cost_source: "inventory",
          value_added_amount: newValueAdded,
          tax_calculation_status: "complete",
        })
        .eq("id", sale.id)
        .eq("store_id", auth.profile.store_id);

      if (updateErr) throw new Error(updateErr.message);

      const revisionsClient = admin as unknown as {
        from: (table: "sales_cost_revisions") => {
          insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
        };
      };
      const { error: revisionErr } = await revisionsClient.from("sales_cost_revisions").insert({
        store_id: auth.profile.store_id,
        sale_id: sale.id,
        old_purchase_cost_amount: sale.purchase_cost_amount,
        new_purchase_cost_amount: cost.sale_cost,
        old_value_added_amount: sale.value_added_amount,
        new_value_added_amount: newValueAdded,
        reason: "bulk_time_based_inventory_recalculate",
        metadata: cost as unknown as Record<string, unknown>,
        recalculated_by: auth.profile.id,
      });
      if (revisionErr) throw new Error(revisionErr.message);

      await recordInventoryMovement(admin, {
        store_id: auth.profile.store_id,
        product_category_id: sale.product_category_id,
        inventory_item_id: input.inventory_item_id,
        source_type: "sale",
        source_id: sale.id,
        source_label: sale.id,
        movement_date: sale.sale_date,
        weight_delta: -Math.abs(Number(cost.sale_weight ?? sale.weight ?? sale.quantity ?? 0)),
        quantity_delta: -Math.abs(Number(sale.quantity ?? 0)),
        cost_delta: -Math.abs(Number(cost.sale_cost ?? 0)),
        unit_cost:
          Number(cost.sale_weight ?? sale.weight ?? sale.quantity ?? 0) > 0
            ? Number(cost.sale_cost ?? 0) /
              Number(cost.sale_weight ?? sale.weight ?? sale.quantity ?? 0)
            : undefined,
        note: "Giảm tồn khi gắn hàng loạt giao dịch bán với tồn kho",
        created_by: auth.profile.id,
      });

      updated.push(sale.id);
      if (period?.id) affectedPeriods.add(period.id);
    } catch (err) {
      skipped.push({ id: sale.id, reason: err instanceof Error ? err.message : "Không tính được giá vốn" });
    }
  }

  for (const periodId of Array.from(affectedPeriods)) {
    try {
      await recalculateTaxPeriod({ storeId: auth.profile.store_id, periodId, calculatedBy: auth.profile.id });
      await cascadeRecalculateYear({ storeId: auth.profile.store_id, fromPeriodId: periodId, calculatedBy: auth.profile.id });
    } catch {
      // Best effort; UI can re-run from tax page.
    }
  }

  try {
    await writeAuditLog(admin, {
      store_id: auth.profile.store_id,
      user_id: auth.profile.id,
      action: "bulk_time_based_inventory_link",
      entity_type: "sales_transactions",
      metadata: { inventory_item_id: input.inventory_item_id, updated_count: updated.length, skipped },
    });
  } catch {
    // Audit log is best-effort; do not fail the user operation.
  }

  return NextResponse.json({ updated_count: updated.length, updated_ids: updated, skipped });
}
