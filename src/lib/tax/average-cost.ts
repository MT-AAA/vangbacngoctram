/**
 * Phase 2D — Average purchase price fallback.
 *
 * When sales rows are missing `purchase_cost_amount`, the shop can estimate
 * cost using the average purchase price computed from manual customer
 * purchases (the `customer_purchases` table) within the selected tax period.
 *
 *     average_purchase_price = SUM(total_amount) / SUM(quantity)
 *                              over customer_purchases in the period,
 *                              grouped by product_category_id,
 *                              filtered to is_tax_purchase_input = true.
 *
 *     estimated_purchase_cost_amount = sales.quantity × average_purchase_price
 *
 * The average is applied ONLY to sales rows where:
 *   - `purchase_cost_amount IS NULL`
 *   - `is_intentionally_ignored = false`
 *   - `product_category_id` resolves to a category with positive average
 *
 * Manual / inventory / excel costs are never overwritten — the apply step
 * additionally re-asserts `purchase_cost_amount IS NULL` in the UPDATE
 * predicate so a row that gained a real cost between preview and apply is
 * silently skipped instead of clobbered.
 *
 * The DB trigger `compute_sales_value_added` already sets
 * `tax_calculation_status = 'estimated'` whenever `purchase_cost_source =
 * 'average'`, so this module only has to set the cost + source.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export type CategoryAverage = {
  category_id: string | null;
  category_name: string;
  total_purchase_amount: number;
  total_purchase_quantity: number;
  average_purchase_price: number;
  source_purchase_count: number;
};

export type AffectedSaleRow = {
  id: string;
  sale_date: string;
  invoice_no: string | null;
  invoice_series: string | null;
  product_name_raw: string;
  product_category_id: string | null;
  category_name: string;
  quantity: number;
  total_amount: number;
  estimated_purchase_cost: number;
  estimated_value_added: number;
};

export type AveragePreview = {
  period: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_locked: boolean;
  };
  categories: CategoryAverage[];
  affected_rows: AffectedSaleRow[];
  totals: {
    affected_count: number;
    total_estimated_cost: number;
    total_estimated_value_added: number;
    /** Sales rows in period that are missing cost but whose category has no
     * average data — kept separate so the UI can explain why they were
     * skipped. */
    skipped_no_average_count: number;
    /** Sales rows missing cost AND missing category (cannot map). */
    skipped_no_category_count: number;
  };
};

export type CustomerPurchaseAggregateInput = {
  product_category_id: string | null;
  total_amount: number | null;
  quantity: number | null;
};

/**
 * Aggregate customer purchases (already filtered to the period and
 * `is_tax_purchase_input = true`) into per-category average price rows.
 *
 * Exported so we can unit-test the aggregation logic in isolation.
 */
export function aggregateAverages(
  rows: CustomerPurchaseAggregateInput[],
  categoryNameById: Map<string | null, string>
): CategoryAverage[] {
  type Acc = {
    total: number;
    qty: number;
    count: number;
  };
  const buckets = new Map<string | null, Acc>();

  for (const row of rows) {
    const total = Number(row.total_amount ?? 0);
    const qty = Number(row.quantity ?? 0);
    if (!Number.isFinite(total) || !Number.isFinite(qty)) continue;
    if (total <= 0 || qty <= 0) continue;
    const key = row.product_category_id ?? null;
    const existing = buckets.get(key) ?? { total: 0, qty: 0, count: 0 };
    existing.total += total;
    existing.qty += qty;
    existing.count += 1;
    buckets.set(key, existing);
  }

  const out: CategoryAverage[] = [];
  buckets.forEach((agg, category_id) => {
    if (agg.qty <= 0) return;
    out.push({
      category_id,
      category_name:
        categoryNameById.get(category_id) ??
        (category_id === null ? "Chưa phân loại" : "—"),
      total_purchase_amount: round2(agg.total),
      total_purchase_quantity: round2(agg.qty),
      average_purchase_price: round2(agg.total / agg.qty),
      source_purchase_count: agg.count,
    });
  });

  out.sort((a, b) => a.category_name.localeCompare(b.category_name, "vi"));
  return out;
}

export type EstimateSaleInput = {
  id: string;
  sale_date: string;
  invoice_no: string | null;
  invoice_series: string | null;
  product_name_raw: string;
  product_category_id: string | null;
  quantity: number | null;
  total_amount: number | null;
};

/**
 * Pure helper: given a list of missing-cost sales rows and the per-category
 * averages, project the rows that can be estimated.
 *
 * Rows with a null `product_category_id` or whose category has no average
 * are NOT returned here — counts for those are derived in the preview.
 */
export function projectAffectedRows(
  sales: EstimateSaleInput[],
  averages: CategoryAverage[]
): AffectedSaleRow[] {
  const avgByCategory = new Map<string, CategoryAverage>();
  for (const a of averages) {
    if (a.category_id) avgByCategory.set(a.category_id, a);
  }

  const out: AffectedSaleRow[] = [];
  for (const s of sales) {
    if (!s.product_category_id) continue;
    const avg = avgByCategory.get(s.product_category_id);
    if (!avg || avg.average_purchase_price <= 0) continue;
    const qty = Number(s.quantity ?? 0);
    const total = Number(s.total_amount ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const estimatedCost = round2(qty * avg.average_purchase_price);
    const estimatedValueAdded = round2(total - estimatedCost);

    out.push({
      id: s.id,
      sale_date: s.sale_date,
      invoice_no: s.invoice_no,
      invoice_series: s.invoice_series,
      product_name_raw: s.product_name_raw,
      product_category_id: s.product_category_id,
      category_name: avg.category_name,
      quantity: qty,
      total_amount: round2(total),
      estimated_purchase_cost: estimatedCost,
      estimated_value_added: estimatedValueAdded,
    });
  }

  out.sort((a, b) => {
    if (a.sale_date < b.sale_date) return -1;
    if (a.sale_date > b.sale_date) return 1;
    return 0;
  });
  return out;
}

/**
 * Build the preview shown before applying the average-cost fallback to a
 * tax period. Read-only.
 */
export async function previewAverageCostApply(
  client: DBClient,
  args: { storeId: string; periodId: string }
): Promise<AveragePreview> {
  const { storeId, periodId } = args;

  const { data: period, error: pErr } = await client
    .from("tax_periods")
    .select("id, name, start_date, end_date, is_locked")
    .eq("id", periodId)
    .eq("store_id", storeId)
    .single();
  if (pErr || !period) {
    throw new Error(pErr?.message ?? "Không tìm thấy kỳ thuế");
  }

  const [
    { data: categoryRows },
    { data: purchaseRows, error: pcErr },
    { data: missingSales, error: sErr },
    { count: skippedNoCategoryCount },
  ] = await Promise.all([
    client
      .from("product_categories")
      .select("id, name")
      .eq("store_id", storeId),
    client
      .from("customer_purchases")
      .select("product_category_id, total_amount, quantity")
      .eq("store_id", storeId)
      .eq("is_tax_purchase_input", true)
      .gte("purchase_date", period.start_date)
      .lte("purchase_date", period.end_date),
    client
      .from("sales_transactions")
      .select(
        "id, sale_date, invoice_no, invoice_series, product_name_raw, product_category_id, quantity, total_amount"
      )
      .eq("store_id", storeId)
      .is("purchase_cost_amount", null)
      .eq("is_intentionally_ignored", false)
      .gte("sale_date", period.start_date)
      .lte("sale_date", period.end_date)
      .not("product_category_id", "is", null),
    client
      .from("sales_transactions")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .is("purchase_cost_amount", null)
      .eq("is_intentionally_ignored", false)
      .gte("sale_date", period.start_date)
      .lte("sale_date", period.end_date)
      .is("product_category_id", null),
  ]);

  if (pcErr) throw new Error(pcErr.message);
  if (sErr) throw new Error(sErr.message);

  const nameById = new Map<string | null, string>();
  for (const c of categoryRows ?? []) {
    nameById.set(c.id, c.name);
  }

  const categories = aggregateAverages(
    (purchaseRows ?? []).map((r) => ({
      product_category_id: r.product_category_id ?? null,
      total_amount: r.total_amount,
      quantity: r.quantity,
    })),
    nameById
  );

  const affected_rows = projectAffectedRows(
    (missingSales ?? []).map((r) => ({
      id: r.id,
      sale_date: r.sale_date,
      invoice_no: r.invoice_no,
      invoice_series: r.invoice_series,
      product_name_raw: r.product_name_raw,
      product_category_id: r.product_category_id,
      quantity: r.quantity,
      total_amount: r.total_amount,
    })),
    categories
  );

  const affected_ids = new Set(affected_rows.map((r) => r.id));
  const skipped_no_average_count =
    (missingSales ?? []).filter((s) => !affected_ids.has(s.id)).length;

  let total_estimated_cost = 0;
  let total_estimated_value_added = 0;
  for (const r of affected_rows) {
    total_estimated_cost += r.estimated_purchase_cost;
    total_estimated_value_added += r.estimated_value_added;
  }

  return {
    period: {
      id: period.id,
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
      is_locked: period.is_locked,
    },
    categories,
    affected_rows,
    totals: {
      affected_count: affected_rows.length,
      total_estimated_cost: round2(total_estimated_cost),
      total_estimated_value_added: round2(total_estimated_value_added),
      skipped_no_average_count,
      skipped_no_category_count: skippedNoCategoryCount ?? 0,
    },
  };
}

export type ApplyOutcome = {
  preview: AveragePreview;
  updated_ids: string[];
  skipped_count: number;
};

/**
 * Apply the average-cost preview: bulk-update each affected sales row to
 * `purchase_cost_amount = round(quantity × avg)`, `purchase_cost_source =
 * 'average'`. Manual / inventory / excel rows are protected by the
 * `purchase_cost_amount IS NULL` predicate in the WHERE clause — they are
 * silently skipped (counted in `skipped_count`).
 *
 * The caller is responsible for triggering `recalculateTaxPeriod` and the
 * audit log; this function is intentionally narrow so it can be reused by
 * background jobs or tests.
 */
export async function applyAverageCost(
  client: DBClient,
  args: { storeId: string; periodId: string; preview?: AveragePreview }
): Promise<ApplyOutcome> {
  const preview =
    args.preview ??
    (await previewAverageCostApply(client, {
      storeId: args.storeId,
      periodId: args.periodId,
    }));

  if (preview.affected_rows.length === 0) {
    return { preview, updated_ids: [], skipped_count: 0 };
  }

  // Group by cost so we can issue one UPDATE per distinct cost value rather
  // than one per row. Numerical-equality keys are safe because we already
  // round to 2 decimals via `round2`.
  const byCost = new Map<number, string[]>();
  for (const r of preview.affected_rows) {
    const cost = r.estimated_purchase_cost;
    const ids = byCost.get(cost) ?? [];
    ids.push(r.id);
    byCost.set(cost, ids);
  }

  const updated_ids: string[] = [];
  const costEntries: Array<[number, string[]]> = [];
  byCost.forEach((ids, cost) => costEntries.push([cost, ids]));

  for (const [cost, ids] of costEntries) {
    const { data, error } = await client
      .from("sales_transactions")
      .update({
        purchase_cost_amount: cost,
        purchase_cost_source: "average",
      })
      .eq("store_id", args.storeId)
      .in("id", ids)
      .is("purchase_cost_amount", null)
      .eq("is_intentionally_ignored", false)
      .select("id");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      updated_ids.push(row.id);
    }
  }

  const skipped_count = preview.affected_rows.length - updated_ids.length;
  return { preview, updated_ids, skipped_count };
}
