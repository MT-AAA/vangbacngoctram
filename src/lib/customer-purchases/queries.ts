/**
 * Server-side queries for `/customer-purchases`.
 *
 * `listCustomerPurchases` powers the listing page; the filter set matches the
 * UI (`/customer-purchases?from=&to=&category=&q=&customer=&tax_input=`). It
 * paginates server-side via Supabase's `.range()` so pages stay cheap.
 *
 * `loadDashboardCustomerPurchases` is consumed by the dashboard data loader
 * and returns the aggregates the dashboard tile shows: totals + missing-field
 * count + the most recent N rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;
export type CustomerPurchaseRow =
  Database["public"]["Tables"]["customer_purchases"]["Row"];

const CUSTOMER_PURCHASE_LIST_SELECT =
  "id, purchase_date, customer_name, customer_phone, customer_tax_code, customer_id_card, " +
  "product_name, product_category_id, purity, unit, quantity, weight, weight_unit, " +
  "unit_price, total_amount, is_tax_purchase_input, becomes_inventory, " +
  "inventory_item_id, image_url, attachment_url, notes, created_at, updated_at, " +
  "category:product_categories(id, name, code)";

export type CustomerPurchaseListRow = CustomerPurchaseRow & {
  category:
    | { id: string; name: string; code: string }
    | { id: string; name: string; code: string }[]
    | null;
};

export type CustomerPurchaseFilters = {
  from?: string;
  to?: string;
  category?: string;
  /** Free-text query — matched against product_name. */
  q?: string;
  /** Free-text query — matched against customer_name / phone / tax_code / id_card. */
  customer?: string;
  /** "1" / "0" — filter to is_tax_purchase_input. */
  taxInput?: string;
  page?: number;
  pageSize?: number;
};

export async function listCustomerPurchases(
  client: DBClient,
  filters: CustomerPurchaseFilters = {}
): Promise<{ rows: CustomerPurchaseListRow[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 50);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("customer_purchases")
    .select(CUSTOMER_PURCHASE_LIST_SELECT, { count: "exact" })
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.from) query = query.gte("purchase_date", filters.from);
  if (filters.to) query = query.lte("purchase_date", filters.to);
  if (filters.category && filters.category !== "all") {
    if (filters.category === "none") {
      query = query.is("product_category_id", null);
    } else {
      query = query.eq("product_category_id", filters.category);
    }
  }
  if (filters.q && filters.q.trim()) {
    const pattern = `%${filters.q.trim()}%`;
    query = query.ilike("product_name", pattern);
  }
  if (filters.customer && filters.customer.trim()) {
    const pattern = `%${filters.customer.trim()}%`;
    query = query.or(
      [
        `customer_name.ilike.${pattern}`,
        `customer_phone.ilike.${pattern}`,
        `customer_tax_code.ilike.${pattern}`,
        `customer_id_card.ilike.${pattern}`,
      ].join(",")
    );
  }
  if (filters.taxInput === "1") {
    query = query.eq("is_tax_purchase_input", true);
  } else if (filters.taxInput === "0") {
    query = query.eq("is_tax_purchase_input", false);
  }

  const { data, count } = await query.range(from, to);

  // Supabase types the wide select string as a generic-string-error union; cast
  // through `unknown` because we know the shape from CUSTOMER_PURCHASE_LIST_SELECT.
  return {
    rows: (data ?? []) as unknown as CustomerPurchaseListRow[],
    total: count ?? 0,
  };
}

export type DashboardCustomerPurchaseSummary = {
  totalAmount: number;
  totalRows: number;
  taxInputAmount: number;
  taxInputRows: number;
  missingCategoryCount: number;
  missingAmountCount: number;
  recent: Array<{
    id: string;
    purchase_date: string;
    customer_name: string | null;
    product_name: string;
    category_name: string | null;
    total_amount: number;
    is_tax_purchase_input: boolean;
  }>;
  rangeRows: Array<{
    total_amount: number | null;
    quantity: number | null;
    weight: number | null;
    category:
      | { name: string; code: string }
      | { name: string; code: string }[]
      | null;
  }>;
};

export async function loadDashboardCustomerPurchases(
  client: DBClient,
  range: { from: string; to: string }
): Promise<DashboardCustomerPurchaseSummary> {
  const [{ data: rangeRows }, { data: recent }] = await Promise.all([
    client
      .from("customer_purchases")
      .select(
        "id, total_amount, product_category_id, is_tax_purchase_input, quantity, weight, category:product_categories(name, code)"
      )
      .gte("purchase_date", range.from)
      .lte("purchase_date", range.to),
    client
      .from("customer_purchases")
      .select(
        "id, purchase_date, customer_name, product_name, total_amount, is_tax_purchase_input, category:product_categories(name)"
      )
      .gte("purchase_date", range.from)
      .lte("purchase_date", range.to)
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  let totalAmount = 0;
  let taxInputAmount = 0;
  let taxInputRows = 0;
  let missingCategoryCount = 0;
  let missingAmountCount = 0;
  for (const r of rangeRows ?? []) {
    const amount = Number(r.total_amount ?? 0);
    totalAmount += amount;
    if (r.is_tax_purchase_input) {
      taxInputAmount += amount;
      taxInputRows += 1;
    }
    if (!r.product_category_id) missingCategoryCount += 1;
    if (!amount || amount <= 0) missingAmountCount += 1;
  }

  return {
    totalAmount,
    totalRows: (rangeRows ?? []).length,
    taxInputAmount,
    taxInputRows,
    missingCategoryCount,
    missingAmountCount,
    recent: (recent ?? []).map((r) => {
      const c = Array.isArray(r.category) ? r.category[0] : r.category;
      return {
        id: r.id,
        purchase_date: r.purchase_date,
        customer_name: r.customer_name,
        product_name: r.product_name,
        category_name: c?.name ?? null,
        total_amount: Number(r.total_amount ?? 0),
        is_tax_purchase_input: r.is_tax_purchase_input,
      };
    }),
    rangeRows: (rangeRows ?? []).map((r) => ({
      total_amount: r.total_amount,
      quantity: r.quantity,
      weight: r.weight,
      category: r.category as DashboardCustomerPurchaseSummary["rangeRows"][number]["category"],
    })),
  };
}
