/**
 * Report 1 — Sales by time (day/month/quarter/year buckets within range).
 *
 * Pure helper `bucketizeSales` is unit-tested with deterministic inputs;
 * `loadSalesByTime` wraps it with a Supabase query.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ReportBucket, ReportRange } from "@/lib/reports/range";

type DBClient = SupabaseClient<Database>;

export type SalesRow = {
  sale_date: string;
  total_amount: number | null;
  purchase_cost_amount: number | null;
  value_added_amount: number | null;
  tax_calculation_status: string | null;
};

export type SalesByTimeBucket = {
  start: string;
  end: string;
  label: string;
  transaction_count: number;
  total_sales_amount: number;
  total_purchase_cost_amount: number;
  value_added_amount: number;
  transactions_estimated: number;
};

export type SalesByTimeReport = {
  range: ReportRange;
  buckets: SalesByTimeBucket[];
  totals: {
    transaction_count: number;
    total_sales_amount: number;
    total_purchase_cost_amount: number;
    value_added_amount: number;
    transactions_estimated: number;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function bucketizeSales(
  rows: SalesRow[],
  buckets: ReportBucket[]
): SalesByTimeBucket[] {
  const out: SalesByTimeBucket[] = buckets.map((b) => ({
    start: b.start,
    end: b.end,
    label: b.label,
    transaction_count: 0,
    total_sales_amount: 0,
    total_purchase_cost_amount: 0,
    value_added_amount: 0,
    transactions_estimated: 0,
  }));

  // Build a lookup table of bucket index by date string for O(B) per-row work.
  // For day-buckets the bucket key is the date itself. For larger buckets we
  // do a single linear scan per row, which is fine — each report fits in one
  // page and B is small.
  for (const row of rows) {
    const d = String(row.sale_date);
    let idx = -1;
    for (let i = 0; i < out.length; i += 1) {
      if (d >= out[i].start && d <= out[i].end) {
        idx = i;
        break;
      }
    }
    if (idx === -1) continue;
    const target = out[idx];
    const sales = Number(row.total_amount ?? 0);
    const cost = Number(row.purchase_cost_amount ?? 0);
    const va = Number(row.value_added_amount ?? sales - cost);
    target.transaction_count += 1;
    target.total_sales_amount = round2(target.total_sales_amount + sales);
    target.total_purchase_cost_amount = round2(
      target.total_purchase_cost_amount + cost
    );
    target.value_added_amount = round2(target.value_added_amount + va);
    if (row.tax_calculation_status === "estimated") {
      target.transactions_estimated += 1;
    }
  }

  return out;
}

export async function loadSalesByTime(
  client: DBClient,
  range: ReportRange
): Promise<SalesByTimeReport> {
  const { data: rows } = await client
    .from("sales_transactions")
    .select(
      "sale_date, total_amount, purchase_cost_amount, value_added_amount, tax_calculation_status"
    )
    .gte("sale_date", range.from)
    .lte("sale_date", range.to);

  const buckets = bucketizeSales((rows ?? []) as SalesRow[], range.buckets);

  const totals = buckets.reduce(
    (acc, b) => {
      acc.transaction_count += b.transaction_count;
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
      total_sales_amount: 0,
      total_purchase_cost_amount: 0,
      value_added_amount: 0,
      transactions_estimated: 0,
    }
  );

  return { range, buckets, totals };
}
