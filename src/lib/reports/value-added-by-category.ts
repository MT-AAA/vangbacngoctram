/**
 * Report 4 — Value added by category.
 *
 * Sibling of `sales-by-category` but emphasises VA columns and adds margin %.
 * Uses the same source data so the totals match exactly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ReportRange } from "@/lib/reports/range";
import {
  loadSalesByCategory,
  type SalesByCategoryRow,
} from "@/lib/reports/sales-by-category";

type DBClient = SupabaseClient<Database>;

export type ValueAddedRow = SalesByCategoryRow & {
  va_margin_pct: number | null;
};

export type ValueAddedReport = {
  range: ReportRange;
  rows: ValueAddedRow[];
  totals: {
    transaction_count: number;
    total_sales_amount: number;
    total_purchase_cost_amount: number;
    value_added_amount: number;
    transactions_estimated: number;
    va_margin_pct: number | null;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function loadValueAddedByCategory(
  client: DBClient,
  range: ReportRange
): Promise<ValueAddedReport> {
  const base = await loadSalesByCategory(client, range);
  const rows: ValueAddedRow[] = base.rows.map((r) => ({
    ...r,
    va_margin_pct:
      r.total_sales_amount > 0
        ? round2((r.value_added_amount / r.total_sales_amount) * 100)
        : null,
  }));
  rows.sort((a, b) => b.value_added_amount - a.value_added_amount);
  return {
    range,
    rows,
    totals: {
      transaction_count: base.totals.transaction_count,
      total_sales_amount: base.totals.total_sales_amount,
      total_purchase_cost_amount: base.totals.total_purchase_cost_amount,
      value_added_amount: base.totals.value_added_amount,
      transactions_estimated: base.totals.transactions_estimated,
      va_margin_pct:
        base.totals.total_sales_amount > 0
          ? round2(
              (base.totals.value_added_amount /
                base.totals.total_sales_amount) *
                100
            )
          : null,
    },
  };
}
