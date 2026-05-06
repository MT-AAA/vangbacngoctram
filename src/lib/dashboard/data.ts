import { createClient } from "@/lib/supabase/server";

export type PeriodKey = "day" | "month" | "quarter" | "year";

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

export function buildRange(period: PeriodKey, ref: Date = new Date()): DateRange {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();

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
  }>;
};

export async function loadDashboard(period: PeriodKey): Promise<DashboardSummary> {
  const supabase = createClient();
  const range = buildRange(period);

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
    { data: inventory },
  ] = await Promise.all([
    supabase
      .from("sales_transactions")
      .select(
        "sale_date, total_amount, purchase_cost_amount, value_added_amount, product_category_id"
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
      .select(
        "quantity_on_hand, weight, category:product_categories(name, code)"
      )
      .eq("status", "in_stock"),
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
  const valueAdded = totalSales - totalCost;
  const estimatedVAT = Math.max(0, valueAdded) * 0.1;
  const negativeCarriedOut = Number(latestReport?.negative_carried_out ?? 0);

  const prevTotalSales = (prevTxns ?? []).reduce(
    (s, t) => s + Number(t.total_amount ?? 0),
    0
  );
  const prevTotalCost = (prevTxns ?? []).reduce(
    (s, t) => s + Number(t.purchase_cost_amount ?? 0),
    0
  );
  const prevValueAdded = prevTotalSales - prevTotalCost;
  const prevEstVAT = Math.max(0, prevValueAdded) * 0.1;
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

  // Inventory snapshot (group by category)
  type InvAgg = { qty: number; weight: number; unit: string };
  const invMap = new Map<string, InvAgg>();
  for (const it of inventory ?? []) {
    const c = Array.isArray(it.category) ? it.category[0] : it.category;
    const name = c?.name ?? "Khác";
    const unit = c?.code === "BAC" ? "lượng" : "chỉ";
    const existing = invMap.get(name) ?? { qty: 0, weight: 0, unit };
    existing.qty += Number(it.quantity_on_hand ?? 0);
    existing.weight += Number(it.weight ?? 0);
    existing.unit = unit;
    invMap.set(name, existing);
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
      };
    });

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
  };
}
