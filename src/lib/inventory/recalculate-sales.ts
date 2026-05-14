import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { calculateTimeBasedInventoryCost } from "@/lib/inventory/time-based-cost";
import { recalculateTaxPeriod, cascadeRecalculateYear } from "@/lib/tax/recalculate";

type AdminClient = SupabaseClient<Database>;

export type RecalculateSalesAfterPurchaseResult = {
  updated_count: number;
  skipped: Array<{ id: string; reason: string }>;
  affected_period_ids: string[];
};

type RevisionClient = {
  from: (table: "sales_cost_revisions") => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

export async function recalculateInventorySalesFromPurchase(
  admin: AdminClient,
  args: {
    storeId: string;
    productCategoryId: string | null;
    purchaseDate: string;
    calculatedBy: string;
  }
): Promise<RecalculateSalesAfterPurchaseResult> {
  if (!args.productCategoryId) {
    return { updated_count: 0, skipped: [], affected_period_ids: [] };
  }

  const { data: sales, error: salesErr } = await admin
    .from("sales_transactions")
    .select(
      "id, sale_date, quantity, weight, weight_unit, total_amount, purchase_cost_amount, value_added_amount, purchase_cost_source, product_category_id"
    )
    .eq("store_id", args.storeId)
    .eq("product_category_id", args.productCategoryId)
    .gte("sale_date", args.purchaseDate)
    .eq("purchase_cost_source", "inventory")
    .eq("is_intentionally_ignored", false)
    .order("sale_date", { ascending: true });

  if (salesErr) throw new Error(salesErr.message);

  const updated: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const affectedPeriods = new Set<string>();

  for (const sale of sales ?? []) {
    const { data: period } = await admin
      .from("tax_periods")
      .select("id, is_locked")
      .eq("store_id", args.storeId)
      .lte("start_date", sale.sale_date)
      .gte("end_date", sale.sale_date)
      .maybeSingle();

    if (period?.is_locked) {
      skipped.push({ id: sale.id, reason: "Kỳ thuế đã khóa" });
      continue;
    }

    try {
      const cost = await calculateTimeBasedInventoryCost(admin, {
        storeId: args.storeId,
        categoryId: args.productCategoryId,
        saleDate: sale.sale_date,
        saleWeight: sale.weight === null ? null : Number(sale.weight),
        saleWeightUnit: sale.weight_unit,
        saleQuantity: Number(sale.quantity ?? 0),
        excludeSaleId: sale.id,
      });

      const oldCost = sale.purchase_cost_amount === null ? null : Number(sale.purchase_cost_amount);
      const newValueAdded = Number(sale.total_amount ?? 0) - cost.sale_cost;

      const salesClient = admin as unknown as {
        from: (table: "sales_transactions") => {
          update: (payload: Record<string, unknown>) => {
            eq: (column: string, value: string) => {
              eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        };
      };
      const { error: updateErr } = await salesClient
        .from("sales_transactions")
        .update({
          purchase_cost_amount: cost.sale_cost,
          purchase_cost_source: "inventory",
          value_added_amount: newValueAdded,
          tax_calculation_status: "complete",
          cost_calculated_at: new Date().toISOString(),
          cost_calculation_method: "time_based_inventory_average",
          cost_calculation_note: `Tự tính lại do có mua khách ngày ${args.purchaseDate}`,
        })
        .eq("id", sale.id)
        .eq("store_id", args.storeId);

      if (updateErr) throw new Error(updateErr.message);

      if (oldCost !== cost.sale_cost) {
        const revisionClient = admin as unknown as RevisionClient;
        const { error: revisionErr } = await revisionClient.from("sales_cost_revisions").insert({
          store_id: args.storeId,
          sale_id: sale.id,
          old_purchase_cost_amount: oldCost,
          new_purchase_cost_amount: cost.sale_cost,
          old_value_added_amount: sale.value_added_amount,
          new_value_added_amount: newValueAdded,
          reason: "customer_purchase_time_based_recalculate",
          metadata: {
            purchase_date: args.purchaseDate,
            cost,
          },
          recalculated_by: args.calculatedBy,
        });
        if (revisionErr) throw new Error(revisionErr.message);
      }

      updated.push(sale.id);
      if (period?.id) affectedPeriods.add(period.id);
    } catch (err) {
      skipped.push({
        id: sale.id,
        reason: err instanceof Error ? err.message : "Không tính lại được giá vốn",
      });
    }
  }

  for (const periodId of Array.from(affectedPeriods)) {
    try {
      await recalculateTaxPeriod({
        storeId: args.storeId,
        periodId,
        calculatedBy: args.calculatedBy,
      });
      await cascadeRecalculateYear({
        storeId: args.storeId,
        fromPeriodId: periodId,
        calculatedBy: args.calculatedBy,
      });
    } catch {
      // Best-effort. Admin có thể chạy lại báo cáo thuế thủ công.
    }
  }

  return {
    updated_count: updated.length,
    skipped,
    affected_period_ids: Array.from(affectedPeriods),
  };
}
