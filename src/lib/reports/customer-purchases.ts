/**
 * Report 8 — Customer purchases.
 *
 * Wraps the same Supabase aggregate as `loadDashboardCustomerPurchases` but
 * returns flat rows for the report table. The "is_tax_purchase_input"
 * sub-total is highlighted because that's what feeds Phase 2D's average-cost
 * fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ReportRange } from "@/lib/reports/range";
import { UNCLASSIFIED_LABEL } from "@/lib/reports/categories";
import { toChi } from "@/lib/reports/weight";

type DBClient = SupabaseClient<Database>;

export type CustomerPurchaseReportRow = {
  id: string;
  purchase_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id_card: string | null;
  customer_tax_code: string | null;
  product_name: string;
  category_id: string | null;
  category_name: string;
  purity: string | null;
  weight: number | null;
  weight_unit: string | null;
  weight_chi: number | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  is_tax_purchase_input: boolean;
  becomes_inventory: boolean;
};

export type CustomerPurchaseReport = {
  range: ReportRange;
  rows: CustomerPurchaseReportRow[];
  totals: {
    row_count: number;
    quantity: number;
    weight_chi: number;
    total_amount: number;
  };
  taxInputTotals: {
    row_count: number;
    quantity: number;
    weight_chi: number;
    total_amount: number;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

type Raw = {
  id: string;
  purchase_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id_card: string | null;
  customer_tax_code: string | null;
  product_name: string;
  product_category_id: string | null;
  purity: string | null;
  weight: number | null;
  weight_unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  is_tax_purchase_input: boolean | null;
  becomes_inventory: boolean | null;
  category: { id: string; name: string } | { id: string; name: string }[] | null;
};

export async function loadCustomerPurchaseReport(
  client: DBClient,
  range: ReportRange,
  filters: { categoryId?: string | null } = {}
): Promise<CustomerPurchaseReport> {
  let q = client
    .from("customer_purchases")
    .select(
      "id, purchase_date, customer_name, customer_phone, customer_id_card, customer_tax_code, product_name, product_category_id, purity, weight, weight_unit, quantity, unit_price, total_amount, is_tax_purchase_input, becomes_inventory, category:product_categories(id, name)"
    )
    .gte("purchase_date", range.from)
    .lte("purchase_date", range.to)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.categoryId === "none") {
    q = q.is("product_category_id", null);
  } else if (filters.categoryId) {
    q = q.eq("product_category_id", filters.categoryId);
  }

  const { data } = await q;
  const raw = (data ?? []) as Raw[];

  const rows: CustomerPurchaseReportRow[] = raw.map((r) => {
    const cat = Array.isArray(r.category) ? r.category[0] : r.category;
    const wRaw = Number(r.weight ?? 0);
    const qty = Number(r.quantity ?? 0);
    const totalRowWeight = wRaw * qty;
    const wChi = toChi(totalRowWeight, r.weight_unit ?? null);
    return {
      id: r.id,
      purchase_date: r.purchase_date,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      customer_id_card: r.customer_id_card,
      customer_tax_code: r.customer_tax_code,
      product_name: r.product_name,
      category_id: r.product_category_id,
      category_name: cat?.name ?? UNCLASSIFIED_LABEL,
      purity: r.purity,
      weight: r.weight !== null ? Number(r.weight) : null,
      weight_unit: r.weight_unit,
      weight_chi: wChi || null,
      quantity: qty,
      unit_price: Number(r.unit_price ?? 0),
      total_amount: Number(r.total_amount ?? 0),
      is_tax_purchase_input: !!r.is_tax_purchase_input,
      becomes_inventory: !!r.becomes_inventory,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.row_count += 1;
      acc.quantity = round2(acc.quantity + r.quantity);
      acc.weight_chi = round2(acc.weight_chi + (r.weight_chi ?? 0));
      acc.total_amount = round2(acc.total_amount + r.total_amount);
      return acc;
    },
    { row_count: 0, quantity: 0, weight_chi: 0, total_amount: 0 }
  );

  const taxInputTotals = rows.reduce(
    (acc, r) => {
      if (!r.is_tax_purchase_input) return acc;
      acc.row_count += 1;
      acc.quantity = round2(acc.quantity + r.quantity);
      acc.weight_chi = round2(acc.weight_chi + (r.weight_chi ?? 0));
      acc.total_amount = round2(acc.total_amount + r.total_amount);
      return acc;
    },
    { row_count: 0, quantity: 0, weight_chi: 0, total_amount: 0 }
  );

  return { range, rows, totals, taxInputTotals };
}
