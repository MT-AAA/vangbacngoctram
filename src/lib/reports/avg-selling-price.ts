/**
 * Report 3 — Average selling price by category and weight.
 *
 * For each product category in [from,to]:
 *   - total_sales_amount
 *   - total_quantity
 *   - total_weight_chi  (normalised across mixed units; "chỉ" = Vietnamese
 *     gold mass, 3.75g; conversion in `lib/reports/weight.ts`)
 *   - avg_unit_price    = total_sales / total_quantity
 *   - avg_price_per_chi = total_sales / total_weight_chi (when known)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ReportRange } from "@/lib/reports/range";
import { UNCLASSIFIED_LABEL } from "@/lib/reports/categories";
import { toChi } from "@/lib/reports/weight";

type DBClient = SupabaseClient<Database>;

export type AvgSellingPriceRow = {
  category_id: string | null;
  category_name: string;
  transaction_count: number;
  total_quantity: number;
  total_weight_chi: number;
  total_sales_amount: number;
  avg_unit_price: number | null;
  avg_price_per_chi: number | null;
};

export type AvgSellingPriceReport = {
  range: ReportRange;
  rows: AvgSellingPriceRow[];
  totals: {
    transaction_count: number;
    total_quantity: number;
    total_weight_chi: number;
    total_sales_amount: number;
    avg_unit_price: number | null;
    avg_price_per_chi: number | null;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const round0 = (n: number) => Math.round(n);

type Tx = {
  product_category_id: string | null;
  total_amount: number | null;
  quantity: number | null;
  weight: number | null;
  weight_unit: string | null;
  category: { id: string; name: string } | { id: string; name: string }[] | null;
};

export async function loadAvgSellingPrice(
  client: DBClient,
  range: ReportRange,
  filters: { categoryId?: string | null } = {}
): Promise<AvgSellingPriceReport> {
  let query = client
    .from("sales_transactions")
    .select(
      "product_category_id, total_amount, quantity, weight, weight_unit, category:product_categories(id, name)"
    )
    .gte("sale_date", range.from)
    .lte("sale_date", range.to);

  if (filters.categoryId === "none") {
    query = query.is("product_category_id", null);
  } else if (filters.categoryId) {
    query = query.eq("product_category_id", filters.categoryId);
  }

  const { data } = await query;
  const rows = (data ?? []) as Tx[];

  const map = new Map<string, AvgSellingPriceRow>();
  for (const r of rows) {
    const cat = Array.isArray(r.category) ? r.category[0] : r.category;
    const id = r.product_category_id ?? "__none__";
    const existing = map.get(id) ?? {
      category_id: r.product_category_id,
      category_name: cat?.name ?? UNCLASSIFIED_LABEL,
      transaction_count: 0,
      total_quantity: 0,
      total_weight_chi: 0,
      total_sales_amount: 0,
      avg_unit_price: null,
      avg_price_per_chi: null,
    };
    existing.transaction_count += 1;
    existing.total_quantity = round2(
      existing.total_quantity + Number(r.quantity ?? 0)
    );
    const totalRowWeight =
      Number(r.quantity ?? 0) * Number(r.weight ?? 0);
    existing.total_weight_chi = round2(
      existing.total_weight_chi + toChi(totalRowWeight, r.weight_unit ?? null)
    );
    existing.total_sales_amount = round2(
      existing.total_sales_amount + Number(r.total_amount ?? 0)
    );
    map.set(id, existing);
  }

  const out = Array.from(map.values()).map((r) => ({
    ...r,
    avg_unit_price:
      r.total_quantity > 0 ? round0(r.total_sales_amount / r.total_quantity) : null,
    avg_price_per_chi:
      r.total_weight_chi > 0
        ? round0(r.total_sales_amount / r.total_weight_chi)
        : null,
  }));

  out.sort((a, b) => b.total_sales_amount - a.total_sales_amount);

  const totals = out.reduce(
    (acc, b) => {
      acc.transaction_count += b.transaction_count;
      acc.total_quantity = round2(acc.total_quantity + b.total_quantity);
      acc.total_weight_chi = round2(acc.total_weight_chi + b.total_weight_chi);
      acc.total_sales_amount = round2(
        acc.total_sales_amount + b.total_sales_amount
      );
      return acc;
    },
    {
      transaction_count: 0,
      total_quantity: 0,
      total_weight_chi: 0,
      total_sales_amount: 0,
    }
  );

  return {
    range,
    rows: out,
    totals: {
      ...totals,
      avg_unit_price:
        totals.total_quantity > 0
          ? round0(totals.total_sales_amount / totals.total_quantity)
          : null,
      avg_price_per_chi:
        totals.total_weight_chi > 0
          ? round0(totals.total_sales_amount / totals.total_weight_chi)
          : null,
    },
  };
}
