/**
 * Paginated list queries + duplicate / reconciliation aggregations for the
 * `/issues/*` pages. Read-only.
 *
 * For `findDuplicateGroups` and `findReconciliationWarnings` we do the
 * grouping in JS on top of `select(...)` because Supabase REST doesn't
 * support `GROUP BY ... HAVING`. The store sizes targeted by this MVP
 * (small Vietnamese gold/silver shops, low tens of thousands of rows per
 * year) make this tradeoff acceptable. If needed later we can promote
 * either to an RPC.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

export type SaleRow = Database["public"]["Tables"]["sales_transactions"]["Row"];

export type ListPage<T> = {
  rows: T[];
  total: number;
};

const DEFAULT_PAGE_SIZE = 50;

export type SaleIssueRow = Pick<
  SaleRow,
  | "id"
  | "sale_date"
  | "invoice_no"
  | "invoice_series"
  | "invoice_key"
  | "product_name_raw"
  | "product_category_id"
  | "quantity"
  | "unit"
  | "unit_price"
  | "total_amount"
  | "purchase_cost_amount"
  | "purchase_cost_source"
  | "tax_calculation_status"
  | "is_intentionally_ignored"
  | "ignored_reason"
  | "customer_name"
> & {
  category?: { name: string; code: string } | { name: string; code: string }[] | null;
};

const SALE_LIST_SELECT =
  "id, sale_date, invoice_no, invoice_series, invoice_key, product_name_raw, product_category_id, quantity, unit, unit_price, total_amount, purchase_cost_amount, purchase_cost_source, tax_calculation_status, is_intentionally_ignored, ignored_reason, customer_name, category:product_categories!inner(name, code)";

export async function listMissingCost(
  client: DBClient,
  opts: {
    page?: number;
    pageSize?: number;
    includeIgnored?: boolean;
    categoryCode?: string | null;
  } = {}
): Promise<ListPage<SaleIssueRow>> {
  const page = Math.max(0, opts.page ?? 0);
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("sales_transactions")
    .select(SALE_LIST_SELECT, { count: "exact" })
    .eq("tax_calculation_status", "missing_purchase_cost");

  if (!opts.includeIgnored) {
    query = query.eq("is_intentionally_ignored", false);
  }

  if (opts.categoryCode) {
    query = query.eq("category.code", opts.categoryCode);
  }

  const { data, count } = await query
    .order("sale_date", { ascending: false })
    .order("invoice_no", { ascending: true })
    .range(from, to);

  return { rows: (data ?? []) as SaleIssueRow[], total: count ?? 0 };
}

/**
 * Given a sales_transaction id, find which 0-based page it sits on inside the
 * `listMissingCost(...)` result (using the same `sale_date desc, invoice_no asc`
 * ordering). Returns null if the row is not in the missing-cost list — caller
 * is expected to fall back to page 0.
 */
export async function findMissingCostPage(
  client: DBClient,
  opts: {
    transactionId: string;
    pageSize?: number;
    includeIgnored?: boolean;
  }
): Promise<number | null> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  const { data: target } = await client
    .from("sales_transactions")
    .select("id, sale_date, invoice_no, tax_calculation_status, is_intentionally_ignored")
    .eq("id", opts.transactionId)
    .maybeSingle();

  if (
    !target ||
    target.tax_calculation_status !== "missing_purchase_cost" ||
    (!opts.includeIgnored && target.is_intentionally_ignored)
  ) {
    return null;
  }

  // Count rows that come strictly before the target in the (sale_date desc,
  // invoice_no asc) ordering.
  // Strictly newer dates: sale_date > target.sale_date
  // Same date, smaller invoice_no: sale_date = target AND invoice_no < target.invoice_no
  let newerQuery = client
    .from("sales_transactions")
    .select("id", { count: "exact", head: true })
    .eq("tax_calculation_status", "missing_purchase_cost")
    .gt("sale_date", target.sale_date);
  if (!opts.includeIgnored) {
    newerQuery = newerQuery.eq("is_intentionally_ignored", false);
  }
  const { count: newerCount } = await newerQuery;

  let sameDayQuery = client
    .from("sales_transactions")
    .select("id", { count: "exact", head: true })
    .eq("tax_calculation_status", "missing_purchase_cost")
    .eq("sale_date", target.sale_date);
  if (!opts.includeIgnored) {
    sameDayQuery = sameDayQuery.eq("is_intentionally_ignored", false);
  }
  if (target.invoice_no !== null && target.invoice_no !== undefined) {
    sameDayQuery = sameDayQuery.lt("invoice_no", target.invoice_no);
  } else {
    // Target has null invoice_no. With ascending order, nulls land at the end
    // for ascending in PostgREST, so nothing same-day comes before it via this
    // path. Skip the sameDayQuery contribution by returning 0.
    return Math.floor((newerCount ?? 0) / pageSize);
  }
  const { count: sameDayBeforeCount } = await sameDayQuery;

  const index = (newerCount ?? 0) + (sameDayBeforeCount ?? 0);
  return Math.floor(index / pageSize);
}

export async function listUnclassified(
  client: DBClient,
  opts: { page?: number; pageSize?: number } = {}
): Promise<ListPage<SaleIssueRow>> {
  const page = Math.max(0, opts.page ?? 0);
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await client
    .from("sales_transactions")
    .select(SALE_LIST_SELECT, { count: "exact" })
    .is("product_category_id", null)
    .order("sale_date", { ascending: false })
    .range(from, to);

  return { rows: (data ?? []) as SaleIssueRow[], total: count ?? 0 };
}

export async function findUnclassifiedPage(
  client: DBClient,
  opts: { transactionId: string; pageSize?: number }
): Promise<number | null> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const { data: target } = await client
    .from("sales_transactions")
    .select("id, sale_date, product_category_id")
    .eq("id", opts.transactionId)
    .maybeSingle();

  if (!target || target.product_category_id !== null) return null;

  const { count } = await client
    .from("sales_transactions")
    .select("id", { count: "exact", head: true })
    .is("product_category_id", null)
    .gt("sale_date", target.sale_date);

  return Math.floor((count ?? 0) / pageSize);
}

export async function listEstimated(
  client: DBClient,
  opts: { page?: number; pageSize?: number } = {}
): Promise<ListPage<SaleIssueRow>> {
  const page = Math.max(0, opts.page ?? 0);
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await client
    .from("sales_transactions")
    .select(SALE_LIST_SELECT, { count: "exact" })
    .eq("tax_calculation_status", "estimated")
    .order("sale_date", { ascending: false })
    .range(from, to);

  return { rows: (data ?? []) as SaleIssueRow[], total: count ?? 0 };
}

export type ReconciliationRow = {
  id: string;
  file_name: string;
  created_at: string;
  status: Database["public"]["Enums"]["import_status"];
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  error_rows: number;
  transaction_line_count: number;
  unique_invoice_count: number;
  total_amount: number;
  period_start: string | null;
  period_end: string | null;
  /** Reasons this file ended up in the warning list. */
  warnings: string[];
};

/**
 * An import_file is a "warning" if any of:
 *   * it failed (status = 'failed'),
 *   * it has error_rows > 0,
 *   * inserted_rows + updated_rows != transaction_line_count
 *     (i.e. some parsed rows didn't make it into the table — typically
 *     a partial upsert failure).
 *
 * Imports that simply re-run on the same file (Mới=0, Cập nhật=406) are
 * NOT warnings — that's the dedupe path working as intended.
 */
export async function findReconciliationWarnings(
  client: DBClient,
  opts: { onlyCount?: boolean } = {}
): Promise<{ count: number; rows: ReconciliationRow[] }> {
  const { data } = await client
    .from("import_files")
    .select(
      "id, file_name, created_at, status, total_rows, inserted_rows, updated_rows, error_rows, transaction_line_count, unique_invoice_count, total_amount, period_start, period_end"
    )
    .order("created_at", { ascending: false })
    .limit(opts.onlyCount ? 500 : 200);

  const rows: ReconciliationRow[] = [];
  for (const r of data ?? []) {
    const warnings: string[] = [];
    if (r.status === "failed") warnings.push("Nhập thất bại");
    if (r.error_rows > 0) warnings.push(`${r.error_rows} dòng lỗi`);
    const committed = (r.inserted_rows ?? 0) + (r.updated_rows ?? 0);
    if (
      r.transaction_line_count > 0 &&
      committed !== r.transaction_line_count
    ) {
      warnings.push(
        `Đã xử lý ${committed}/${r.transaction_line_count} dòng (chênh ${
          r.transaction_line_count - committed
        })`
      );
    }
    if (warnings.length === 0) continue;
    rows.push({ ...r, warnings });
  }

  return {
    count: rows.length,
    rows: opts.onlyCount ? [] : rows,
  };
}

export type DuplicateGroup = {
  /** Stable id for use as React key. */
  group_key: string;
  invoice_key: string | null;
  invoice_no: string | null;
  product_name_raw: string;
  unit: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  count: number;
  row_ids: string[];
  /** "duplicate_within_invoice" or "shared_invoice_no" */
  kind: "duplicate_within_invoice" | "shared_invoice_no";
};

/**
 * Two flavors of "suspicious" returned together:
 *
 *   * duplicate_within_invoice — the same (invoice_key, product, qty,
 *     unit_price) appears more than once. transaction_hash differs only
 *     because source_stt differs, so they were intentionally separate
 *     lines in the source Excel — but more often than not duplicates.
 *
 *   * shared_invoice_no — different invoice_keys share the same raw
 *     `invoice_no`. This happens legitimately when the same number is
 *     re-used across invoice series, but is more often a sign of a CQT
 *     export / template mistake.
 */
export async function findDuplicateGroups(
  client: DBClient,
  opts: { onlyCount?: boolean; limit?: number } = {}
): Promise<{ count: number; groups: DuplicateGroup[] }> {
  const limit = opts.limit ?? 1000;

  const { data } = await client
    .from("sales_transactions")
    .select(
      "id, invoice_key, invoice_no, product_name_raw, unit, quantity, unit_price, total_amount"
    )
    .not("invoice_key", "is", null)
    .neq("duplicate_resolution_status", "merged")
    .order("invoice_key", { ascending: true })
    .order("product_name_raw", { ascending: true })
    .limit(limit);

  const withinInvoice = new Map<string, DuplicateGroup>();
  const byInvoiceNo = new Map<string, Set<string>>();
  const rowsByInvoiceNo = new Map<
    string,
    Array<{
      id: string;
      invoice_key: string | null;
      invoice_no: string | null;
      product_name_raw: string;
      unit: string | null;
      quantity: number;
      unit_price: number;
      total_amount: number;
    }>
  >();

  for (const r of data ?? []) {
    const key = [
      r.invoice_key ?? "",
      r.product_name_raw ?? "",
      r.unit ?? "",
      String(r.quantity ?? 0),
      String(r.unit_price ?? 0),
    ].join("|");

    const existing = withinInvoice.get(key);
    if (existing) {
      existing.count += 1;
      existing.row_ids.push(r.id);
    } else {
      withinInvoice.set(key, {
        group_key: `wii:${key}`,
        invoice_key: r.invoice_key,
        invoice_no: r.invoice_no,
        product_name_raw: r.product_name_raw,
        unit: r.unit,
        quantity: Number(r.quantity ?? 0),
        unit_price: Number(r.unit_price ?? 0),
        total_amount: Number(r.total_amount ?? 0),
        count: 1,
        row_ids: [r.id],
        kind: "duplicate_within_invoice",
      });
    }

    if (r.invoice_no) {
      const set = byInvoiceNo.get(r.invoice_no) ?? new Set<string>();
      if (r.invoice_key) set.add(r.invoice_key);
      byInvoiceNo.set(r.invoice_no, set);
      const arr = rowsByInvoiceNo.get(r.invoice_no) ?? [];
      arr.push(r);
      rowsByInvoiceNo.set(r.invoice_no, arr);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const g of Array.from(withinInvoice.values())) {
    if (g.count > 1) groups.push(g);
  }

  // Shared-invoice-no groups: collapse all rows under the same
  // (invoice_no with multiple invoice_keys) into a single suspicious
  // entry.
  for (const [invoiceNo, keys] of Array.from(byInvoiceNo.entries())) {
    if (keys.size <= 1) continue;
    const rows = rowsByInvoiceNo.get(invoiceNo) ?? [];
    if (rows.length === 0) continue;
    groups.push({
      group_key: `sin:${invoiceNo}`,
      invoice_key: null,
      invoice_no: invoiceNo,
      product_name_raw: rows[0].product_name_raw,
      unit: rows[0].unit,
      quantity: Number(rows[0].quantity ?? 0),
      unit_price: Number(rows[0].unit_price ?? 0),
      total_amount: rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0),
      count: rows.length,
      row_ids: rows.map((r) => r.id),
      kind: "shared_invoice_no",
    });
  }

  return {
    count: groups.length,
    groups: opts.onlyCount ? [] : groups,
  };
}

export type NegativeVATRow = {
  tax_period_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  negative_carried_out: number;
};

export async function listNegativeVATPeriods(
  client: DBClient
): Promise<NegativeVATRow[]> {
  const { data } = await client
    .from("tax_reports")
    .select(
      "tax_period_id, negative_carried_out, period:tax_periods!inner(name, start_date, end_date)"
    )
    .gt("negative_carried_out", 0)
    .order("negative_carried_out", { ascending: false })
    .limit(50);

  type Joined = {
    tax_period_id: string;
    negative_carried_out: number;
    period:
      | { name: string; start_date: string; end_date: string }
      | { name: string; start_date: string; end_date: string }[]
      | null;
  };

  return (data as Joined[] | null ?? []).flatMap((r) => {
    const period = Array.isArray(r.period) ? r.period[0] : r.period;
    if (!period) return [];
    return [
      {
        tax_period_id: r.tax_period_id,
        period_name: period.name,
        start_date: period.start_date,
        end_date: period.end_date,
        negative_carried_out: Number(r.negative_carried_out ?? 0),
      },
    ];
  });
}
