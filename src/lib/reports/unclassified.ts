/**
 * Report 9 — Unclassified products.
 *
 * Lists `sales_transactions` whose `product_category_id IS NULL` in
 * [from,to]. The page mirrors the relevant columns from the listing page so
 * users can scan and link out to /issues/unclassified for triage.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ReportRange } from "@/lib/reports/range";

type DBClient = SupabaseClient<Database>;

export type UnclassifiedRow = {
  id: string;
  sale_date: string;
  invoice_no: string | null;
  product_name_raw: string;
  quantity: number;
  total_amount: number;
  purchase_cost_amount: number | null;
  tax_calculation_status: string | null;
};

export type UnclassifiedReport = {
  range: ReportRange;
  rows: UnclassifiedRow[];
  totals: {
    count: number;
    total_amount: number;
    missing_purchase_cost: number;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

type Raw = {
  id: string;
  sale_date: string;
  invoice_no: string | null;
  product_name_raw: string;
  quantity: number | null;
  total_amount: number | null;
  purchase_cost_amount: number | null;
  tax_calculation_status: string | null;
};

export async function loadUnclassifiedReport(
  client: DBClient,
  range: ReportRange
): Promise<UnclassifiedReport> {
  const { data } = await client
    .from("sales_transactions")
    .select(
      "id, sale_date, invoice_no, product_name_raw, quantity, total_amount, purchase_cost_amount, tax_calculation_status"
    )
    .is("product_category_id", null)
    .gte("sale_date", range.from)
    .lte("sale_date", range.to)
    .order("sale_date", { ascending: false });

  const rows: UnclassifiedRow[] = ((data ?? []) as Raw[]).map((r) => ({
    id: r.id,
    sale_date: r.sale_date,
    invoice_no: r.invoice_no,
    product_name_raw: r.product_name_raw,
    quantity: Number(r.quantity ?? 0),
    total_amount: Number(r.total_amount ?? 0),
    purchase_cost_amount:
      r.purchase_cost_amount !== null ? Number(r.purchase_cost_amount) : null,
    tax_calculation_status: r.tax_calculation_status,
  }));

  const totals = rows.reduce(
    (acc, r) => {
      acc.count += 1;
      acc.total_amount = round2(acc.total_amount + r.total_amount);
      if (r.tax_calculation_status === "missing_purchase_cost") {
        acc.missing_purchase_cost += 1;
      }
      return acc;
    },
    { count: 0, total_amount: 0, missing_purchase_cost: 0 }
  );

  return { range, rows, totals };
}
