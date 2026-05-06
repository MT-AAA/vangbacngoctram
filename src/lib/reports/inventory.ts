/**
 * Report 7 — Inventory.
 *
 * Lists in-stock `inventory_items` (populated by Phase 2C
 * customer-purchase ingestion). Filterable by category and status.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { UNCLASSIFIED_LABEL } from "@/lib/reports/categories";
import { toChi } from "@/lib/reports/weight";

type DBClient = SupabaseClient<Database>;

export type InventoryStatus = "in_stock" | "sold" | "reserved" | "written_off";

export type InventoryRow = {
  id: string;
  sku: string | null;
  name: string;
  category_id: string | null;
  category_name: string;
  weight: number | null;
  weight_unit: string | null;
  weight_chi: number | null;
  quantity_on_hand: number;
  unit_cost: number;
  total_cost: number;
  status: InventoryStatus;
  created_at: string;
};

export type InventoryReport = {
  rows: InventoryRow[];
  totals: {
    item_count: number;
    total_quantity: number;
    total_weight_chi: number;
    total_value: number;
  };
  byCategory: Array<{
    category_id: string | null;
    category_name: string;
    item_count: number;
    total_quantity: number;
    total_weight_chi: number;
    total_value: number;
  }>;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

type RawRow = {
  id: string;
  sku: string | null;
  name: string;
  product_category_id: string | null;
  weight: number | null;
  weight_unit: string | null;
  quantity_on_hand: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  status: InventoryStatus;
  created_at: string;
  category: { id: string; name: string } | { id: string; name: string }[] | null;
};

export async function loadInventoryReport(
  client: DBClient,
  filters: { categoryId?: string | null; status?: InventoryStatus } = {}
): Promise<InventoryReport> {
  const status: InventoryStatus = filters.status ?? "in_stock";
  let q = client
    .from("inventory_items")
    .select(
      "id, sku, name, product_category_id, weight, weight_unit, quantity_on_hand, unit_cost, total_cost, status, created_at, category:product_categories(id, name)"
    )
    .eq("status", status);

  if (filters.categoryId === "none") {
    q = q.is("product_category_id", null);
  } else if (filters.categoryId) {
    q = q.eq("product_category_id", filters.categoryId);
  }

  const { data } = await q;
  const raw = (data ?? []) as RawRow[];

  const rows: InventoryRow[] = raw.map((r) => {
    const cat = Array.isArray(r.category) ? r.category[0] : r.category;
    const qty = Number(r.quantity_on_hand ?? 0);
    const wRaw = Number(r.weight ?? 0);
    const totalRowWeight = qty * wRaw;
    const wChi = toChi(totalRowWeight, r.weight_unit ?? null);
    return {
      id: r.id,
      sku: r.sku,
      name: r.name,
      category_id: r.product_category_id,
      category_name: cat?.name ?? UNCLASSIFIED_LABEL,
      weight: r.weight !== null ? Number(r.weight) : null,
      weight_unit: r.weight_unit,
      weight_chi: wChi || null,
      quantity_on_hand: qty,
      unit_cost: Number(r.unit_cost ?? 0),
      total_cost: Number(r.total_cost ?? 0),
      status: r.status,
      created_at: r.created_at,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.item_count += 1;
      acc.total_quantity = round2(acc.total_quantity + r.quantity_on_hand);
      acc.total_weight_chi = round2(
        acc.total_weight_chi + (r.weight_chi ?? 0)
      );
      acc.total_value = round2(acc.total_value + r.total_cost);
      return acc;
    },
    { item_count: 0, total_quantity: 0, total_weight_chi: 0, total_value: 0 }
  );

  const byCatMap = new Map<string, InventoryReport["byCategory"][number]>();
  for (const r of rows) {
    const id = r.category_id ?? "__none__";
    const e =
      byCatMap.get(id) ?? {
        category_id: r.category_id,
        category_name: r.category_name,
        item_count: 0,
        total_quantity: 0,
        total_weight_chi: 0,
        total_value: 0,
      };
    e.item_count += 1;
    e.total_quantity = round2(e.total_quantity + r.quantity_on_hand);
    e.total_weight_chi = round2(e.total_weight_chi + (r.weight_chi ?? 0));
    e.total_value = round2(e.total_value + r.total_cost);
    byCatMap.set(id, e);
  }

  rows.sort((a, b) => a.category_name.localeCompare(b.category_name, "vi"));
  const byCategory = Array.from(byCatMap.values()).sort(
    (a, b) => b.total_value - a.total_value
  );

  return { rows, totals, byCategory };
}
