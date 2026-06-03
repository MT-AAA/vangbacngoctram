import { createAdminClient } from "@/lib/supabase/admin";
import { computeVAT } from "@/lib/tax/vat-engine";

/**
 * Recalculate a single tax period: re-aggregates sales transactions in range,
 * computes carry-in from prior periods within the same calendar year, and
 * upserts the corresponding tax_reports row.
 *
 * Returns the resulting tax_report row.
 */
export async function recalculateTaxPeriod(args: {
  storeId: string;
  periodId: string;
  calculatedBy?: string | null;
}) {
  const admin = createAdminClient();

  const { data: period, error: pErr } = await admin
    .from("tax_periods")
    .select("*")
    .eq("id", args.periodId)
    .eq("store_id", args.storeId)
    .single();
  if (pErr || !period) throw new Error(pErr?.message ?? "Không tìm thấy kỳ thuế");

  // Tax settings
  const { data: settings } = await admin
    .from("tax_settings")
    .select("vat_rate")
    .eq("store_id", args.storeId)
    .maybeSingle();
  const vatRate = Number(settings?.vat_rate ?? 10);

  // Aggregate sales transactions in range
  const { data: txns, error: tErr } = await admin
    .from("sales_transactions")
    .select(
      "total_amount, purchase_cost_amount, tax_calculation_status, value_added_amount"
    )
    .eq("store_id", args.storeId)
    .eq("is_intentionally_ignored", false)
    .or("duplicate_resolution_status.is.null,duplicate_resolution_status.neq.merged")
    .gte("sale_date", period.start_date)
    .lte("sale_date", period.end_date);
  if (tErr) throw new Error(tErr.message);

  const aggregate = {
    total_sales_amount: 0,
    total_purchase_cost_amount: 0,
    total_transactions: 0,
    transactions_missing_purchase_cost: 0,
    transactions_estimated: 0,
  };
  for (const t of txns ?? []) {
    aggregate.total_transactions += 1;
    aggregate.total_sales_amount += Number(t.total_amount ?? 0);
    aggregate.total_purchase_cost_amount += Number(t.purchase_cost_amount ?? 0);
    if (t.tax_calculation_status === "missing_purchase_cost")
      aggregate.transactions_missing_purchase_cost += 1;
    if (t.tax_calculation_status === "estimated")
      aggregate.transactions_estimated += 1;
  }

  // Carry-in: sum of negative_carried_out from prior periods within the same calendar year
  // that ended on or before this period's start.
  const { data: prior } = await admin
    .from("tax_reports")
    .select("negative_carried_out, period:tax_periods!inner(year, end_date)")
    .eq("store_id", args.storeId)
    .order("calculated_at", { ascending: true });

  let carryIn = 0;
  // We need the most recent prior period in the same year whose end_date < this period's start_date.
  // Simpler approach: pick the report whose period's end_date is the largest value < period.start_date,
  // within the same calendar year.
  let bestEnd = "";
  let bestCarry = 0;
  for (const row of prior ?? []) {
    const p = Array.isArray(row.period) ? row.period[0] : row.period;
    if (!p) continue;
    if (p.year !== period.year) continue;
    if (p.end_date >= period.start_date) continue;
    if (p.end_date > bestEnd) {
      bestEnd = p.end_date;
      bestCarry = Number(row.negative_carried_out ?? 0);
    }
  }
  carryIn = bestCarry;

  const result = computeVAT({ aggregate, negative_carried_in: carryIn, vat_rate: vatRate });

  // Upsert into tax_reports
  const { data: existing } = await admin
    .from("tax_reports")
    .select("id")
    .eq("store_id", args.storeId)
    .eq("tax_period_id", args.periodId)
    .maybeSingle();

  const payload = {
    store_id: args.storeId,
    tax_period_id: args.periodId,
    total_sales_amount: result.total_sales_amount,
    total_purchase_cost_amount: result.total_purchase_cost_amount,
    value_added_amount: result.value_added_amount,
    negative_carried_in: result.negative_carried_in,
    taxable_value_added: result.taxable_value_added,
    vat_rate: result.vat_rate,
    vat_amount: result.vat_amount,
    negative_carried_out: result.negative_carried_out,
    total_transactions: result.total_transactions,
    transactions_missing_purchase_cost:
      result.transactions_missing_purchase_cost,
    transactions_estimated: result.transactions_estimated,
    calculated_at: new Date().toISOString(),
    calculated_by: args.calculatedBy ?? null,
  };

  if (existing) {
    const { data, error } = await admin
      .from("tax_reports")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  } else {
    const { data, error } = await admin
      .from("tax_reports")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}

/**
 * Recalculate all later periods within the same calendar year so that carry-in
 * cascades correctly when an earlier period is updated.
 */
export async function cascadeRecalculateYear(args: {
  storeId: string;
  fromPeriodId: string;
  calculatedBy?: string | null;
}) {
  const admin = createAdminClient();
  const { data: from } = await admin
    .from("tax_periods")
    .select("year, start_date")
    .eq("id", args.fromPeriodId)
    .eq("store_id", args.storeId)
    .single();
  if (!from) return;

  const { data: laterPeriods } = await admin
    .from("tax_periods")
    .select("id")
    .eq("store_id", args.storeId)
    .eq("year", from.year)
    .gt("start_date", from.start_date)
    .order("start_date", { ascending: true });

  for (const lp of laterPeriods ?? []) {
    await recalculateTaxPeriod({
      storeId: args.storeId,
      periodId: lp.id,
      calculatedBy: args.calculatedBy ?? null,
    });
  }
}
