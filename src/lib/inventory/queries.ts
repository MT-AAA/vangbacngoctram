/**
 * Read-only data layer for the `/inventory` page.
 *
 * - `loadInventoryList` returns paginated rows + the total row count for the
 *   filter combination. The expensive grouping for the summary cards is
 *   computed in `loadInventorySummary` separately so the table can be
 *   paginated without re-aggregating.
 *
 * Filtering rules:
 *   * `category` accepts a category id, the literal "none" (= null) or undef
 *   * `status` accepts an inventory_status value or "active"
 *     (= everything except 'archived' and 'sold')
 *   * `missing_cost` = true → only rows that need a cost set
 *   * `low_stock`    = true → current_quantity < 1 (jewelry items are
 *                              typically tracked one-at-a-time, so anything
 *                              less than one piece counts as low stock)
 *   * `q_sku` / `q_name` → ILIKE substring search
 *   * `from` / `to` → bounds on imported_at (or created_at fallback)
 *
 * RLS handles the per-store filter for us — every callsite passes the
 * authenticated client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

export type InventoryRow = {
  id: string;
  sku: string | null;
  name: string;
  product_type: string | null;
  purity: string | null;
  unit: string | null;
  initial_quantity: number | null;
  current_quantity: number | null;
  initial_weight: number | null;
  current_weight: number | null;
  weight_unit: string;
  purchase_unit_price: number | null;
  purchase_cost_amount: number | null;
  selling_price: number | null;
  source_type: Database["public"]["Enums"]["inventory_source_type"];
  source_id: string | null;
  source_reference: string | null;
  status: Database["public"]["Enums"]["inventory_status"];
  is_tax_cost_source: boolean;
  imported_at: string | null;
  created_at: string;
  notes: string | null;
  attachment_url: string | null;
  product_category_id: string | null;
  category: { id: string; name: string; code: string } | null;
};

const SELECT =
  "id, sku, name, product_type, purity, unit, initial_quantity, current_quantity, initial_weight, current_weight, weight_unit, purchase_unit_price, purchase_cost_amount, selling_price, source_type, source_id, source_reference, status, is_tax_cost_source, imported_at, created_at, notes, attachment_url, product_category_id, category:product_categories(id, name, code)";

export type InventoryFilters = {
  category?: string | null;
  status?: string | null;
  source?: string | null;
  missing_cost?: boolean;
  low_stock?: boolean;
  q_sku?: string | null;
  q_name?: string | null;
  from?: string | null;
  to?: string | null;
};

export type ListInventoryArgs = InventoryFilters & {
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 50;
export const LOW_STOCK_THRESHOLD = 1;

function applyFilters<T>(
  q: ReturnType<DBClient["from"]>["select"] extends (...a: unknown[]) => infer R
    ? R
    : never,
  filters: InventoryFilters
): T {
  // The Supabase JS builder type is recursive and clashes with our generic
  // helper, so we operate on `any` here and cast at the call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = q;

  if (filters.category === "none") {
    query = query.is("product_category_id", null);
  } else if (filters.category) {
    query = query.eq("product_category_id", filters.category);
  }

  if (filters.status === "active") {
    query = query.not("status", "in", "(archived,sold)");
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.source) {
    query = query.eq("source_type", filters.source);
  }

  if (filters.missing_cost) {
    query = query
      .is("purchase_cost_amount", null)
      .eq("is_tax_cost_source", true);
  }

  if (filters.low_stock) {
    query = query.lt("current_quantity", LOW_STOCK_THRESHOLD);
  }

  if (filters.q_sku) {
    query = query.ilike("sku", `%${filters.q_sku}%`);
  }
  if (filters.q_name) {
    query = query.ilike("name", `%${filters.q_name}%`);
  }
  if (filters.from) {
    query = query.gte("imported_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("imported_at", filters.to);
  }

  return query as T;
}

export async function loadInventoryList(
  client: DBClient,
  args: ListInventoryArgs = {}
): Promise<{ rows: InventoryRow[]; total: number }> {
  const page = Math.max(0, args.page ?? 0);
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const base = client
    .from("inventory_items")
    .select(SELECT, { count: "exact" });
  const filtered = applyFilters<typeof base>(base, args);

  const { data, count } = await filtered
    .order("imported_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  return { rows: (data ?? []) as InventoryRow[], total: count ?? 0 };
}

export type InventorySummary = {
  totalItems: number;
  weightVangTa: number;
  weightVangTay: number;
  weightBac: number;
  totalPurchaseCost: number;
  missingCostCount: number;
  lowStockCount: number;
};

/**
 * Aggregations for the summary cards. Two cheap COUNT queries (missing-cost,
 * low-stock) plus one row-level fetch we group in JS — the row counts are
 * small (low tens of thousands) so this is fine.
 */
export async function loadInventorySummary(
  client: DBClient
): Promise<InventorySummary> {
  const [activeRes, missingRes, lowStockRes] = await Promise.all([
    client
      .from("inventory_items")
      .select(
        "current_quantity, current_weight, purchase_cost_amount, category:product_categories(code)"
      )
      .not("status", "in", "(archived,sold)"),
    client
      .from("inventory_items")
      .select("id", { count: "exact", head: true })
      .is("purchase_cost_amount", null)
      .eq("is_tax_cost_source", true)
      .not("status", "in", "(archived,sold)"),
    client
      .from("inventory_items")
      .select("id", { count: "exact", head: true })
      .lt("current_quantity", LOW_STOCK_THRESHOLD)
      .not("status", "in", "(archived,sold)"),
  ]);

  let totalItems = 0;
  let weightVangTa = 0;
  let weightVangTay = 0;
  let weightBac = 0;
  let totalPurchaseCost = 0;

  for (const row of (activeRes.data ?? []) as Array<{
    current_quantity: number | null;
    current_weight: number | null;
    purchase_cost_amount: number | null;
    category:
      | { code: string | null }
      | { code: string | null }[]
      | null;
  }>) {
    totalItems += 1;
    totalPurchaseCost += Number(row.purchase_cost_amount ?? 0);
    const cat = Array.isArray(row.category) ? row.category[0] : row.category;
    const code = cat?.code?.toLowerCase() ?? null;
    const weight = Number(row.current_weight ?? 0);
    if (code === "vang_ta") weightVangTa += weight;
    else if (code === "vang_tay") weightVangTay += weight;
    else if (code === "bac") weightBac += weight;
  }

  return {
    totalItems,
    weightVangTa,
    weightVangTay,
    weightBac,
    totalPurchaseCost,
    missingCostCount: missingRes.count ?? 0,
    lowStockCount: lowStockRes.count ?? 0,
  };
}

/**
 * Fetch a single inventory row by id (uses the authenticated client so RLS
 * blocks cross-store reads).
 */
export async function loadInventoryItem(
  client: DBClient,
  id: string
): Promise<InventoryRow | null> {
  const { data } = await client
    .from("inventory_items")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as InventoryRow | null) ?? null;
}

/**
 * Picker query for "Gắn với tồn kho" on the sales screen.
 *
 * Sorts by:
 *   1. same product_category as the sale row (if provided)
 *   2. ILIKE substring match on the product name
 *   3. imported_at desc
 *
 * Only returns rows that are still in stock and dùng làm giá vốn.
 */
export async function loadInventoryPicker(
  client: DBClient,
  args: {
    categoryId?: string | null;
    nameLike?: string | null;
    excludeIds?: string[];
    limit?: number;
  } = {}
): Promise<InventoryRow[]> {
  const limit = args.limit ?? 30;
  let query = client
    .from("inventory_items")
    .select(SELECT)
    .in("status", ["in_stock", "partially_sold", "reserved"])
    .eq("is_tax_cost_source", true)
    .gt("current_quantity", 0);

  if (args.nameLike) {
    query = query.ilike("name", `%${args.nameLike}%`);
  }
  if (args.excludeIds && args.excludeIds.length > 0) {
    query = query.not("id", "in", `(${args.excludeIds.join(",")})`);
  }

  const { data } = await query
    .order("imported_at", { ascending: false, nullsFirst: false })
    .limit(limit * 2);

  const rows = (data ?? []) as InventoryRow[];
  if (!args.categoryId) return rows.slice(0, limit);

  const sameCat: InventoryRow[] = [];
  const otherCat: InventoryRow[] = [];
  for (const r of rows) {
    if (r.product_category_id === args.categoryId) sameCat.push(r);
    else otherCat.push(r);
  }
  return [...sameCat, ...otherCat].slice(0, limit);
}
