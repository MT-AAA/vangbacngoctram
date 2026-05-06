/**
 * Report 2 — Sales by product category.
 *
 * Aggregates `sales_transactions` in [from,to] grouped by `product_category_id`
 * (with a single bucket for null categories shown as "Chưa phân loại").
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ReportRange } from "@/lib/reports/range";
import { UNCLASSIFIED_LABEL } from "@/lib/reports/categories";

type DBClient = SupabaseClient<Database>;

export type SalesByCategoryRow = {
  category_id: string | null;
  category_name: string;
  category_code: string | null;
  transaction_count: number;
  total_quantity: number;
  total_sales_amount: number;
  total_purchase_cost_amount: number;
  value_added_amount: number;
  transactions_estimated: number;
  share_pct: number;
};

export type SalesByCategoryReport = {
  range: ReportRange;
  rows: SalesByCategoryRow[];
  totals: {
    transaction_count: number;
    total_quantity: number;
    total_sales_amount: number;
    total_purchase_cost_amount: number;
    value_added_amount: number;
    transactions_estimated: number;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

type Tx = {
  product_category_id: string | null;
  total_amount: number | null;
  purchase_cost_amount: number | null;
  value_added_amount: number | null;
  quantity: number | null;
  tax_calculation_status: string | null;
  category: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;
};

export async function loadSalesByCategory(
  client: DBClient,
  range: ReportRange
): Promise<SalesByCategoryReport> {
  const { data } = await client
    .from("sales_transactions")
    .select(
      "product_category_id, total_amount, purchase_cost_amount, value_added_amount, quantity, tax_calculation_status, category:product_categories(id, code, name)"
    )
    .gte("sale_date", range.from)
    .lte("sale_date", range.to);

  const rows = (data ?? []) as Tx[];

  const map = new Map<string, SalesByCategoryRow>();
  for (const r of rows) {
    const cat = Array.isArray(r.category) ? r.category[0] : r.category;
    const id = r.product_category_id ?? "__none__";
    const existing = map.get(id) ?? {
      category_id: r.product_category_id,
      category_name: cat?.name ?? UNCLASSIFIED_LABEL,
      category_code: cat?.code ?? null,
      transaction_count: 0,
      total_quantity: 0,
      total_sales_amount: 0,
      total_purchase_cost_amount: 0,
      value_added_amount: 0,
      transactions_estimated: 0,
      share_pct: 0,
    };
    existing.transaction_count += 1;
    existing.total_quantity = round2(
      existing.total_quantity + Number(r.quantity ?? 0)
    );
    existing.total_sales_amount = round2(
      existing.total_sales_amount + Number(r.total_amount ?? 0)
    );
    existing.total_purchase_cost_amount = round2(
      existing.total_purchase_cost_amount + Number(r.purchase_cost_amount ?? 0)
    );
    existing.value_added_amount = round2(
      existing.value_added_amount +
        Number(
          r.value_added_amount ??
            Number(r.total_amount ?? 0) - Number(r.purchase_cost_amount ?? 0)
        )
    );
    if (r.tax_calculation_status === "estimated") {
      existing.transactions_estimated += 1;
    }
    map.set(id, existing);
  }

  const out = Array.from(map.values());

  const totals = out.reduce(
    (acc, b) => {
      acc.transaction_count += b.transaction_count;
      acc.total_quantity = round2(acc.total_quantity + b.total_quantity);
      acc.total_sales_amount = round2(
        acc.total_sales_amount + b.total_sales_amount
      );
      acc.total_purchase_cost_amount = round2(
        acc.total_purchase_cost_amount + b.total_purchase_cost_amount
      );
      acc.value_added_amount = round2(
        acc.value_added_amount + b.value_added_amount
      );
      acc.transactions_estimated += b.transactions_estimated;
      return acc;
    },
    {
      transaction_count: 0,
      total_quantity: 0,
      total_sales_amount: 0,
      total_purchase_cost_amount: 0,
      value_added_amount: 0,
      transactions_estimated: 0,
    }
  );

  for (const r of out) {
    r.share_pct =
      totals.total_sales_amount > 0
        ? round2((r.total_sales_amount / totals.total_sales_amount) * 100)
        : 0;
  }

  out.sort((a, b) => b.total_sales_amount - a.total_sales_amount);

  return { range, rows: out, totals };
}
