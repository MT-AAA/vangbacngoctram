import { createClient } from "@/lib/supabase/server";
import { computeVAT } from "@/lib/tax/vat-engine";
import {
  loadDashboardCustomerPurchases,
  type DashboardCustomerPurchaseSummary,
} from "@/lib/customer-purchases/queries";

export type PeriodKey = "day" | "month" | "quarter" | "year" | "custom";

export type CustomRange = {
  /** ISO yyyy-mm-dd. */
  from: string;
  /** ISO yyyy-mm-dd. */
  to: string;
};

export type DateRange = {
  start: Date;
  end: Date;
  label: string;
  /** Bucket size for time-series aggregation. */
  bucket: "day" | "month";
  buckets: Array<{ start: Date; end: Date; label: string }>;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function parseISODateUTC(s: string): Date | null {
  // Accept yyyy-mm-dd only.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildRange(
  period: PeriodKey,
  ref: Date = new Date(),
  custom?: CustomRange
): DateRange {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();

  if (custom) {
    const start = parseISODateUTC(custom.from);
    const end = parseISODateUTC(custom.to);
    if (start && end && start.getTime() <= end.getTime()) {
      const dayMs = 24 * 60 * 60 * 1000;
      const days = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
      const buckets: DateRange["buckets"] = [];
      // Use day buckets when the range is short, month buckets otherwise.
      if (days <= 62) {
        for (let i = 0; i < days; i++) {
          const day = new Date(start.getTime() + i * dayMs);
          buckets.push({
            start: day,
            end: day,
            label: `${pad(day.getUTCDate())}/${pad(day.getUTCMonth() + 1)}`,
          });
        }
        return {
          start,
          end,
          label: `${toISOVN(start)} - ${toISOVN(end)}`,
          bucket: "day",
          buckets,
        };
      }
      // Month buckets.
      const cursor = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
      );
      while (cursor.getTime() <= end.getTime()) {
        const bs = new Date(cursor);
        const be = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)
        );
        buckets.push({
          start: bs.getTime() < start.getTime() ? start : bs,
          end: be.getTime() > end.getTime() ? end : be,
          label: `${pad(bs.getUTCMonth() + 1)}/${bs.getUTCFullYear()}`,
        });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
      return {
        start,
        end,
        label: `${toISOVN(start)} - ${toISOVN(end)}`,
        bucket: "month",
        buckets,
      };
    }
    // Fall through to default month range when custom is invalid.
  }

  if (period === "day") {
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));
    const buckets: DateRange["buckets"] = [];
    for (let d = 1; d <= end.getUTCDate(); d++) {
      const day = new Date(Date.UTC(y, m, d));
      buckets.push({
        start: day,
        end: day,
        label: `${pad(d)}/${pad(m + 1)}`,
      });
    }
    return {
      start,
      end,
      label: `${toISOVN(start)} - ${toISOVN(end)}`,
      bucket: "day",
      buckets,
    };
  }
  if (period === "month") {
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));
    const buckets: DateRange["buckets"] = [];
    for (let d = 1; d <= end.getUTCDate(); d++) {
      const day = new Date(Date.UTC(y, m, d));
      buckets.push({
        start: day,
        end: day,
        label: `${pad(d)}/${pad(m + 1)}`,
      });
    }
    return {
      start,
      end,
      label: `${toISOVN(start)} - ${toISOVN(end)}`,
      bucket: "day",
      buckets,
    };
  }
  if (period === "quarter") {
    const q = Math.floor(m / 3);
    const start = new Date(Date.UTC(y, q * 3, 1));
    const end = new Date(Date.UTC(y, q * 3 + 3, 0));
    const buckets: DateRange["buckets"] = [];
    for (let i = 0; i < 3; i++) {
      const bs = new Date(Date.UTC(y, q * 3 + i, 1));
      const be = new Date(Date.UTC(y, q * 3 + i + 1, 0));
      buckets.push({
        start: bs,
        end: be,
        label: `${pad(q * 3 + i + 1)}/${y}`,
      });
    }
    return {
      start,
      end,
      label: `Quý ${q + 1}/${y}`,
      bucket: "month",
      buckets,
    };
  }
  // year
  const start = new Date(Date.UTC(y, 0, 1));
  const end = new Date(Date.UTC(y, 11, 31));
  const buckets: DateRange["buckets"] = [];
  for (let i = 0; i < 12; i++) {
    const bs = new Date(Date.UTC(y, i, 1));
    const be = new Date(Date.UTC(y, i + 1, 0));
    buckets.push({
      start: bs,
      end: be,
      label: pad(i + 1),
    });
  }
  return {
    start,
    end,
    label: `Năm ${y}`,
    bucket: "month",
    buckets,
  };
}

function toISOVN(d: Date): string {
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function previousRange(range: DateRange): { start: Date; end: Date } {
  const ms = range.end.getTime() - range.start.getTime() + 24 * 60 * 60 * 1000;
  return {
    start: new Date(range.start.getTime() - ms),
    end: new Date(range.start.getTime() - 24 * 60 * 60 * 1000),
  };
}

export type DashboardSummary = {
  range: DateRange;
  totals: {
    sales: number;
    cost: number;
    valueAdded: number;
    estimatedVAT: number; // value added × 10% as a quick estimate
    negativeCarriedOut: number; // from latest tax_report
    missingCount: number;
    estimatedCount: number;
    unclassifiedCount: number;
    totalTransactions: number;
  };
  changeVsPrev: {
    sales: number | null;
    cost: number | null;
    valueAdded: number | null;
    estimatedVAT: number | null;
    negativeCarriedOut: number | null;
  };
  series: Array<{ label: string; revenue: number; tax: number }>;
  categoryShares: Array<{ name: string; value: number }>;
  vatByPeriod: Array<{ label: string; vat: number }>;
  recentTransactions: Array<{
    id: string;
    sale_date: string;
    product_name: string;
    category_name: string | null;
    total_amount: number;
    purchase_cost_amount: number | null;
    value_added_amount: number | null;
    tax_calculation_status: string;
  }>;
  recentImports: Array<{
    id: string;
    file_name: string;
    created_at: string;
    status: string;
    total_rows: number;
    error_rows: number;
  }>;
  inventorySnapshot: Array<{
    category: string;
    qty_unit: string;
    quantity: number;
    weight_kg: number;
    average_unit_cost: number | null;
  }>;
  salesByCategory: Array<{
    category: string;
    qty_unit: string;
    quantity: number;
    weight_kg: number;
    amount: number;
    taxAmount: number;
  }>;
  purchasesByCategory: Array<{
    category: string;
    qty_unit: string;
    quantity: number;
    weight_kg: number;
    amount: number;
  }>;
  inventoryAlerts: {
    missingCost: number;
    lowStock: number;
  };
  customerPurchases: DashboardCustomerPurchaseSummary;
};

export async function loadDashboard(
  period: PeriodKey,
  custom?: CustomRange
): Promise<DashboardSummary> {
  const supabase = createClient();
  const range = buildRange(period, new Date(), custom);

  const fromISO = toISO(range.start);
  const toISOEnd = toISO(range.end);

  const prev = previousRange(range);
  const prevFromISO = toISO(prev.start);
  const prevToISO = toISO(prev.end);

  const [
    { data: txns },
    { data: prevTxns },
    { count: totalCount },
    { count: missingCount },
    { count: estimatedCount },
    { count: unclassifiedCount },
    { data: latestReport },
    { data: prevReport },
    { data: vatPeriods },
    { data: categories },
    { data: recent },
    { data: imports },
    { data: inventoryAlertsSource },
    { data: inventoryMovements },
    { data: taxSettings },
    { data: priorReport },
    customerPurchases,
  ] = await Promise.all([
    supabase
      .from("sales_transactions")
      .select(
        "sale_date, total_amount, purchase_cost_amount, value_added_amount, product_category_id, quantity, weight, category:product_categories(name, code)"
      )
      .gte("sale_date", fromISO)
      .lte("sale_date", toISOEnd),
    supabase
      .from("sales_transactions")
      .select("total_amount, purchase_cost_amount, value_added_amount")
      .gte("sale_date", prevFromISO)
      .lte("sale_date", prevToISO),
    supabase
      .from("sales_transactions")
      .select("id", { count: "exact", head: true })
      .gte("sale_date", fromISO)
      .lte("sale_date", toISOEnd),
    supabase
      .from("sales_transactions")
      .select("id", { count: "exact", head: true })
      .eq("tax_calculation_status", "missing_purchase_cost")
      .eq("is_intentionally_ignored", false)
      .gte("sale_date", fromISO)
      .lte("sale_date", toISOEnd),
    supabase
      .from("sales_transactions")
      .select("id", { count: "exact", head: true })
      .eq("tax_calculation_status", "estimated")
      .gte("sale_date", fromISO)
      .lte("sale_date", toISOEnd),
    supabase
      .from("sales_transactions")
      .select("id", { count: "exact", head: true })
      .is("product_category_id", null)
      .gte("sale_date", fromISO)
      .lte("sale_date", toISOEnd),
    supabase
      .from("tax_reports")
      .select("*, period:tax_periods(name, start_date, end_date)")
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tax_reports")
      .select("vat_amount, value_added_amount, negative_carried_out")
      .order("calculated_at", { ascending: false })
      .range(1, 1)
      .maybeSingle(),
    supabase
      .from("tax_reports")
      .select("vat_amount, period:tax_periods!inner(name, start_date)")
      .order("calculated_at", { ascending: false })
      .limit(6),
    supabase.from("product_categories").select("id, name, code"),
    supabase
      .from("sales_transactions")
      .select(
        "id, sale_date, product_name_raw, total_amount, purchase_cost_amount, value_added_amount, tax_calculation_status, category:product_categories(name, code)"
      )
      .gte("sale_date", fromISO)
      .lte("sale_date", toISOEnd)
      .order("sale_date", { ascending: false })
      .limit(5),
    supabase
      .from("import_files")
      .select("id, file_name, created_at, status, total_rows, error_rows")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("inventory_items")
      .select("current_quantity, purchase_cost_amount, is_tax_cost_source")
      .not("status", "in", "(archived,sold)"),
    supabase
      .from("inventory_movements")
      .select(
        "source_type, weight_delta, quantity_delta, cost_delta, category:product_categories(name, code)"
      )
      .or(`source_type.eq.opening_balance,movement_date.lte.${toISOEnd}`),
    supabase.from("tax_settings").select("vat_rate").maybeSingle(),
    supabase
      .from("tax_reports")
      .select("negative_carried_out, period:tax_periods!inner(year, end_date)")
      .lt("period.end_date", fromISO)
      .eq("period.year", range.start.getUTCFullYear())
      .order("end_date", { referencedTable: "tax_periods", ascending: false })
      .limit(1)
      .maybeSingle(),
    loadDashboardCustomerPurchases(supabase, {
      from: fromISO,
      to: toISOEnd,
    }),
  ]);

  // Aggregate totals
  const totalSales = (txns ?? []).reduce(
    (s, t) => s + Number(t.total_amount ?? 0),
    0
  );
  const totalCost = (txns ?? []).reduce(
    (s, t) => s + Number(t.purchase_cost_amount ?? 0),
    0
  );
  const vatRate = Number(taxSettings?.vat_rate ?? 10);
  const negativeCarriedIn = Number(priorReport?.negative_carried_out ?? 0);
  const vatResult = computeVAT({
    aggregate: {
      total_sales_amount: totalSales,
      total_purchase_cost_amount: totalCost,
      total_transactions: totalCount ?? 0,
      transactions_missing_purchase_cost: missingCount ?? 0,
      transactions_estimated: estimatedCount ?? 0,
    },
    negative_carried_in: negativeCarriedIn,
    vat_rate: vatRate,
  });
  const valueAdded = vatResult.value_added_amount;
  const estimatedVAT = vatResult.vat_amount;
  const negativeCarriedOut = vatResult.negative_carried_out;

  const prevTotalSales = (prevTxns ?? []).reduce(
    (s, t) => s + Number(t.total_amount ?? 0),
    0
  );
  const prevTotalCost = (prevTxns ?? []).reduce(
    (s, t) => s + Number(t.purchase_cost_amount ?? 0),
    0
  );
  const prevVatResult = computeVAT({
    aggregate: {
      total_sales_amount: prevTotalSales,
      total_purchase_cost_amount: prevTotalCost,
      total_transactions: prevTxns?.length ?? 0,
      transactions_missing_purchase_cost: 0,
      transactions_estimated: 0,
    },
    negative_carried_in: 0,
    vat_rate: vatRate,
  });
  const prevValueAdded = prevVatResult.value_added_amount;
  const prevEstVAT = prevVatResult.vat_amount;
  const prevNegativeCarriedOut = Number(prevReport?.negative_carried_out ?? 0);

  const pct = (cur: number, prev: number): number | null => {
    if (!prev || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  // Time-series by bucket
  const series = range.buckets.map((b) => {
    const bStart = toISO(b.start);
    const bEnd = toISO(b.end);
    let revenue = 0;
    for (const t of txns ?? []) {
      const d = String(t.sale_date);
      if (d >= bStart && d <= bEnd) revenue += Number(t.total_amount ?? 0);
    }
    // Tax estimate = 10% of value-added in bucket (if positive)
    let cost = 0;
    let bucketSales = 0;
    for (const t of txns ?? []) {
      const d = String(t.sale_date);
      if (d >= bStart && d <= bEnd) {
        bucketSales += Number(t.total_amount ?? 0);
        cost += Number(t.purchase_cost_amount ?? 0);
      }
    }
    const va = bucketSales - cost;
    const tax = Math.max(0, va) * 0.1;
    return { label: b.label, revenue, tax };
  });

  // Category shares
  const catNameById = new Map<string, string>();
  for (const c of categories ?? []) catNameById.set(c.id, c.name);
  const sharesMap = new Map<string, number>();
  for (const t of txns ?? []) {
    const name = t.product_category_id
      ? catNameById.get(t.product_category_id) ?? "Chưa phân loại"
      : "Chưa phân loại";
    sharesMap.set(name, (sharesMap.get(name) ?? 0) + Number(t.total_amount ?? 0));
  }
  // Order: Vàng ta, Vàng tây, Bạc, others
  const order = ["Vàng ta", "Vàng tây", "Bạc"];
  const ordered: Array<{ name: string; value: number }> = [];
  for (const o of order) {
    const v = sharesMap.get(o);
    if (v !== undefined) {
      ordered.push({ name: o, value: v });
      sharesMap.delete(o);
    }
  }
  sharesMap.forEach((value, name) => ordered.push({ name, value }));

  // VAT by period (most recent N periods, in chronological order)
  const vatByPeriod = (vatPeriods ?? [])
    .slice()
    .reverse()
    .map((r) => {
      const p = Array.isArray(r.period) ? r.period[0] : r.period;
      return {
        label: p?.name ?? "",
        vat: Number(r.vat_amount ?? 0),
      };
    });

  // Recent transactions
  const recentTransactions = (recent ?? []).map((r) => {
    const c = Array.isArray(r.category) ? r.category[0] : r.category;
    return {
      id: r.id,
      sale_date: r.sale_date,
      product_name: r.product_name_raw,
      category_name: c?.name ?? null,
      total_amount: Number(r.total_amount ?? 0),
      purchase_cost_amount:
        r.purchase_cost_amount === null ? null : Number(r.purchase_cost_amount),
      value_added_amount:
        r.value_added_amount === null ? null : Number(r.value_added_amount),
      tax_calculation_status: r.tax_calculation_status as string,
    };
  });

  // Inventory snapshot (group by category) is the running balance from the
  // movement ledger: opening balance + customer purchases - sales/adjustments.
  // Do not read `inventory_items.current_weight` here because average-pool rows
  // can become stale if sales are recalculated after the pool was created.
  type InvAgg = { qty: number; weight: number; value: number; unit: string };
  const invMap = new Map<string, InvAgg>();
  let missingCostAlert = 0;
  let lowStockAlert = 0;

  for (const movement of inventoryMovements ?? []) {
    const c = Array.isArray(movement.category)
      ? movement.category[0]
      : movement.category;
    const name = c?.name ?? "Khác";
    if (!order.includes(name)) continue;

    const existing = invMap.get(name) ?? { qty: 0, weight: 0, value: 0, unit: "chỉ" };
    existing.qty += Number(movement.quantity_delta ?? movement.weight_delta ?? 0);
    existing.weight += Number(movement.weight_delta ?? movement.quantity_delta ?? 0);
    existing.value += Number(movement.cost_delta ?? 0);
    invMap.set(name, existing);
  }

  for (const it of inventoryAlertsSource ?? []) {
    const qty = Number(it.current_quantity ?? 0);
    if (it.is_tax_cost_source && it.purchase_cost_amount === null) {
      missingCostAlert += 1;
    }
    if (qty < 1) {
      lowStockAlert += 1;
    }
  }
  const inventorySnapshot = order
    .filter((n) => invMap.has(n))
    .map((n) => {
      const v = invMap.get(n)!;
      // Weight stored in chỉ (3.75g) for gold, lượng (37.5g) for silver.
      const gramsPerUnit = v.unit === "lượng" ? 37.5 : 3.75;
      return {
        category: n,
        qty_unit: v.unit,
        quantity: v.weight,
        weight_kg: (v.weight * gramsPerUnit) / 1000,
        average_unit_cost: v.weight > 0 ? v.value / v.weight : null,
      };
    });

  type MovementAgg = {
    quantity: number;
    weight: number;
    amount: number;
    unit: string;
    costAmount?: number;
    taxAmount?: number;
  };
  const toMovementRows = (map: Map<string, MovementAgg>) =>
    order.map((category) => {
      const v = map.get(category) ?? {
        quantity: 0,
        weight: 0,
        amount: 0,
        unit: "chỉ",
        taxAmount: 0,
      };
      const gramsPerUnit = v.unit === "lượng" ? 37.5 : 3.75;
      return {
        category,
        qty_unit: v.unit,
        quantity: v.weight || v.quantity,
        weight_kg: ((v.weight || v.quantity) * gramsPerUnit) / 1000,
        amount: v.amount,
        taxAmount: v.taxAmount ?? 0,
      };
    });

  const salesMovementMap = new Map<string, MovementAgg>();
  for (const t of txns ?? []) {
    const c = Array.isArray(t.category) ? t.category[0] : t.category;
    const category = c?.name;
    if (!category || !order.includes(category)) continue;
    const unit = "chỉ";
    const existing = salesMovementMap.get(category) ?? {
      quantity: 0,
      weight: 0,
      amount: 0,
      unit,
    };
    existing.quantity += Number(t.quantity ?? 0);
    existing.weight += Number(t.weight ?? t.quantity ?? 0);
    existing.amount += Number(t.total_amount ?? 0);
    existing.costAmount =
      (existing.costAmount ?? 0) + Number(t.purchase_cost_amount ?? 0);
    existing.unit = unit;
    salesMovementMap.set(category, existing);
  }

  const purchaseMovementMap = new Map<string, MovementAgg>();
  for (const r of customerPurchases.rangeRows ?? []) {
    const c = Array.isArray(r.category) ? r.category[0] : r.category;
    const category = c?.name;
    if (!category || !order.includes(category)) continue;
    const unit = "chỉ";
    const existing = purchaseMovementMap.get(category) ?? {
      quantity: 0,
      weight: 0,
      amount: 0,
      unit,
    };
    existing.quantity += Number(r.quantity ?? 0);
    existing.weight += Number(r.weight ?? r.quantity ?? 0);
    existing.amount += Number(r.total_amount ?? 0);
    existing.unit = unit;
    purchaseMovementMap.set(category, existing);
  }

  salesMovementMap.forEach((item) => {
    item.taxAmount = (item.amount - (item.costAmount ?? 0)) * 0.1;
  });

  const salesByCategory = toMovementRows(salesMovementMap);
  const purchasesByCategory = toMovementRows(purchaseMovementMap);

  return {
    range,
    totals: {
      sales: totalSales,
      cost: totalCost,
      valueAdded,
      estimatedVAT,
      negativeCarriedOut,
      missingCount: missingCount ?? 0,
      estimatedCount: estimatedCount ?? 0,
      unclassifiedCount: unclassifiedCount ?? 0,
      totalTransactions: totalCount ?? 0,
    },
    changeVsPrev: {
      sales: pct(totalSales, prevTotalSales),
      cost: pct(totalCost, prevTotalCost),
      valueAdded: pct(valueAdded, prevValueAdded),
      estimatedVAT: pct(estimatedVAT, prevEstVAT),
      negativeCarriedOut: pct(negativeCarriedOut, prevNegativeCarriedOut),
    },
    series,
    categoryShares: ordered,
    vatByPeriod,
    recentTransactions,
    recentImports: (imports ?? []).map((i) => ({
      id: i.id,
      file_name: i.file_name,
      created_at: i.created_at,
      status: i.status,
      total_rows: i.total_rows ?? 0,
      error_rows: i.error_rows ?? 0,
    })),
    inventorySnapshot,
    salesByCategory,
    purchasesByCategory,
    inventoryAlerts: {
      missingCost: missingCostAlert,
      lowStock: lowStockAlert,
    },
    customerPurchases,
  };
}
