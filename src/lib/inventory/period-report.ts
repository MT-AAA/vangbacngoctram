import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildRange, type PeriodKey } from "@/lib/dashboard/data";

export type InventoryPeriod = PeriodKey;

type DBClient = SupabaseClient<Database>;

type MovementRow = {
  id: string;
  product_category_id: string;
  source_type: string;
  source_id: string | null;
  source_label: string | null;
  movement_date: string;
  weight_delta: number;
  quantity_delta: number;
  cost_delta: number;
  unit_cost: number | null;
  note: string | null;
  category: { id: string; name: string; code: string } | null;
};

export type InventoryRollupRow = {
  category_id: string;
  category_name: string;
  category_code: string;
  opening_weight: number;
  period_in_weight: number;
  period_out_weight: number;
  current_weight: number;
  current_cost: number;
  average_cost: number;
  status: "ok" | "low" | "negative";
};

export type InventoryDashboardSummary = {
  totalCurrentWeight: number;
  totalCurrentCost: number;
  averageCost: number;
  periodInWeight: number;
  periodOutWeight: number;
  byCode: Record<string, number>;
};

export type InventoryDetailGroup = {
  key: string;
  label: string;
  source_type: string;
  total_weight: number;
  total_cost: number;
  rows: Array<{
    id: string;
    date: string;
    label: string;
    weight: number;
    cost: number;
    note: string | null;
  }>;
};

export type InventoryPeriodReport = {
  rows: InventoryRollupRow[];
  summary: InventoryDashboardSummary;
  detailGroups: InventoryDetailGroup[];
};

const SOURCE_LABELS: Record<string, string> = {
  opening_balance: "Tồn đầu kỳ",
  customer_purchase: "Mua từ khách",
  manual: "Nhập tay",
  sale: "Bán/xuất",
  adjustment: "Điều chỉnh",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadInventoryPeriodReport(
  client: DBClient,
  filters: {
    period?: InventoryPeriod;
    from?: string | null;
    to?: string | null;
    category?: string | null;
  } = {}
): Promise<InventoryPeriodReport> {
  const period = filters.period ?? "month";
  const hasExplicitRange = Boolean(filters.from && filters.to);
  const range = buildRange(
    hasExplicitRange ? "custom" : period,
    new Date(),
    hasExplicitRange ? { from: filters.from!, to: filters.to! } : undefined
  );
  const from = toISO(range.start);
  const to = toISO(range.end);

  let query = client
    .from("inventory_movements")
    .select(
      "id, product_category_id, source_type, source_id, source_label, movement_date, weight_delta, quantity_delta, cost_delta, unit_cost, note, category:product_categories(id, name, code)"
    )
    .lte("movement_date", to)
    .order("movement_date", { ascending: false });

  if (filters.category) query = query.eq("product_category_id", filters.category);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as MovementRow[];
  const byCategory = new Map<string, InventoryRollupRow>();

  for (const row of rows) {
    const cat = row.category;
    if (!cat) continue;
    const existing = byCategory.get(row.product_category_id) ?? {
      category_id: row.product_category_id,
      category_name: cat.name,
      category_code: cat.code,
      opening_weight: 0,
      period_in_weight: 0,
      period_out_weight: 0,
      current_weight: 0,
      current_cost: 0,
      average_cost: 0,
      status: "ok" as const,
    };

    const weight = Number(row.weight_delta ?? 0);
    const cost = Number(row.cost_delta ?? 0);

    if (row.movement_date < from || row.source_type === "opening_balance") {
      existing.opening_weight = round2(existing.opening_weight + weight);
      existing.current_weight = round2(existing.current_weight + weight);
      existing.current_cost = round2(existing.current_cost + cost);
    } else if (row.movement_date >= from && row.movement_date <= to) {
      existing.current_weight = round2(existing.current_weight + weight);
      existing.current_cost = round2(existing.current_cost + cost);
      if (weight > 0) {
        existing.period_in_weight = round2(existing.period_in_weight + weight);
      }
      if (weight < 0) {
        existing.period_out_weight = round2(existing.period_out_weight + Math.abs(weight));
      }
    }
    byCategory.set(row.product_category_id, existing);
  }

  const rollups: InventoryRollupRow[] = Array.from(byCategory.values()).map((r) => {
    const status: InventoryRollupRow["status"] =
      r.current_weight < 0 ? "negative" : r.current_weight <= 1 ? "low" : "ok";
    return {
      ...r,
      average_cost: r.current_weight > 0 ? round2(r.current_cost / r.current_weight) : 0,
      status,
    };
  });

  const detailMap = new Map<string, InventoryDetailGroup>();
  for (const row of rows.filter((r) => r.movement_date >= from && r.movement_date <= to)) {
    const key = row.source_type;
    const group = detailMap.get(key) ?? {
      key,
      label: SOURCE_LABELS[key] ?? key,
      source_type: key,
      total_weight: 0,
      total_cost: 0,
      rows: [],
    };
    group.total_weight = round2(group.total_weight + Number(row.weight_delta ?? 0));
    group.total_cost = round2(group.total_cost + Number(row.cost_delta ?? 0));
    group.rows.push({
      id: row.id,
      date: row.movement_date,
      label: row.source_label ?? row.category?.name ?? "Phát sinh",
      weight: Number(row.weight_delta ?? 0),
      cost: Number(row.cost_delta ?? 0),
      note: row.note,
    });
    detailMap.set(key, group);
  }

  const summary = rollups.reduce<InventoryDashboardSummary>(
    (acc, row) => {
      acc.totalCurrentWeight = round2(acc.totalCurrentWeight + row.current_weight);
      acc.totalCurrentCost = round2(acc.totalCurrentCost + row.current_cost);
      acc.periodInWeight = round2(acc.periodInWeight + row.period_in_weight);
      acc.periodOutWeight = round2(acc.periodOutWeight + row.period_out_weight);
      acc.byCode[row.category_code] = row.current_weight;
      return acc;
    },
    {
      totalCurrentWeight: 0,
      totalCurrentCost: 0,
      averageCost: 0,
      periodInWeight: 0,
      periodOutWeight: 0,
      byCode: {},
    }
  );
  summary.averageCost =
    summary.totalCurrentWeight > 0
      ? round2(summary.totalCurrentCost / summary.totalCurrentWeight)
      : 0;

  return {
    rows: rollups.sort((a, b) => a.category_name.localeCompare(b.category_name, "vi")),
    summary,
    detailGroups: Array.from(detailMap.values()),
  };
}
