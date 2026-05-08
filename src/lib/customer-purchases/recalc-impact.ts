import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type RecalcImpact = {
  affected_sales_count: number;
  locked_period_count: number;
  earliest_sale_date: string | null;
};

export async function getPurchaseRecalcImpact(
  client: SupabaseClient<Database>,
  args: {
    storeId: string;
    productCategoryId: string | null;
    purchaseDate: string;
  }
): Promise<RecalcImpact> {
  if (!args.productCategoryId) {
    return { affected_sales_count: 0, locked_period_count: 0, earliest_sale_date: null };
  }

  const { data: sales, error } = await client
    .from("sales_transactions")
    .select("id, sale_date")
    .eq("store_id", args.storeId)
    .eq("product_category_id", args.productCategoryId)
    .gte("sale_date", args.purchaseDate)
    .eq("purchase_cost_source", "inventory")
    .eq("is_intentionally_ignored", false)
    .order("sale_date", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = sales ?? [];
  if (rows.length === 0) {
    return { affected_sales_count: 0, locked_period_count: 0, earliest_sale_date: null };
  }

  const { data: periods, error: periodErr } = await client
    .from("tax_periods")
    .select("id, start_date, end_date, is_locked")
    .eq("store_id", args.storeId)
    .lte("start_date", rows[rows.length - 1].sale_date)
    .gte("end_date", rows[0].sale_date);

  if (periodErr) throw new Error(periodErr.message);

  const locked = new Set<string>();
  for (const sale of rows) {
    const period = (periods ?? []).find(
      (p) => p.start_date <= sale.sale_date && p.end_date >= sale.sale_date
    );
    if (period?.is_locked) locked.add(period.id);
  }

  return {
    affected_sales_count: rows.length,
    locked_period_count: locked.size,
    earliest_sale_date: rows[0]?.sale_date ?? null,
  };
}
