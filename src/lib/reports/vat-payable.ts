/**
 * Reports 5 + 6 — VAT payable + Negative carry-forward.
 *
 * Source: `tax_reports` joined with `tax_periods` (so the VAT amount comes
 * from the persisted, recalc'd direct-method computation — never from the
 * e-invoice's vat_output_amount).
 *
 * The range filter selects all periods that overlap [from,to] (i.e.
 * `start_date <= to AND end_date >= from`).
 *
 * Both reports share the same loader to ensure their data is consistent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ReportRange } from "@/lib/reports/range";

type DBClient = SupabaseClient<Database>;

export type VatPeriodRow = {
  period_id: string;
  period_name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  year: number;
  total_sales_amount: number;
  total_purchase_cost_amount: number;
  value_added_amount: number;
  negative_carried_in: number;
  taxable_value_added: number;
  vat_rate: number;
  vat_amount: number;
  negative_carried_out: number;
  total_transactions: number;
  transactions_missing_purchase_cost: number;
  transactions_estimated: number;
  is_locked: boolean;
};

export type VatPayableReport = {
  range: ReportRange;
  rows: VatPeriodRow[];
  totals: {
    total_sales_amount: number;
    total_purchase_cost_amount: number;
    value_added_amount: number;
    taxable_value_added: number;
    vat_amount: number;
    transactions_estimated: number;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

type RawRow = {
  total_sales_amount: number | null;
  total_purchase_cost_amount: number | null;
  value_added_amount: number | null;
  negative_carried_in: number | null;
  taxable_value_added: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  negative_carried_out: number | null;
  total_transactions: number | null;
  transactions_missing_purchase_cost: number | null;
  transactions_estimated: number | null;
  period:
    | {
        id: string;
        name: string;
        period_type: string;
        start_date: string;
        end_date: string;
        year: number;
        is_locked: boolean;
      }
    | Array<{
        id: string;
        name: string;
        period_type: string;
        start_date: string;
        end_date: string;
        year: number;
        is_locked: boolean;
      }>
    | null;
};

export async function loadVatPayableReport(
  client: DBClient,
  range: ReportRange
): Promise<VatPayableReport> {
  const { data } = await client
    .from("tax_reports")
    .select(
      "total_sales_amount, total_purchase_cost_amount, value_added_amount, negative_carried_in, taxable_value_added, vat_rate, vat_amount, negative_carried_out, total_transactions, transactions_missing_purchase_cost, transactions_estimated, period:tax_periods!inner(id, name, period_type, start_date, end_date, year, is_locked)"
    );

  const raw = (data ?? []) as RawRow[];

  const rows: VatPeriodRow[] = raw
    .map((r) => {
      const p = Array.isArray(r.period) ? r.period[0] : r.period;
      if (!p) return null;
      // Range filter applied client-side: include any period that overlaps
      // [from, to] (start <= to AND end >= from).
      if (p.start_date > range.to) return null;
      if (p.end_date < range.from) return null;
      return {
        period_id: p.id,
        period_name: p.name,
        period_type: p.period_type,
        start_date: p.start_date,
        end_date: p.end_date,
        year: p.year,
        total_sales_amount: Number(r.total_sales_amount ?? 0),
        total_purchase_cost_amount: Number(r.total_purchase_cost_amount ?? 0),
        value_added_amount: Number(r.value_added_amount ?? 0),
        negative_carried_in: Number(r.negative_carried_in ?? 0),
        taxable_value_added: Number(r.taxable_value_added ?? 0),
        vat_rate: Number(r.vat_rate ?? 0),
        vat_amount: Number(r.vat_amount ?? 0),
        negative_carried_out: Number(r.negative_carried_out ?? 0),
        total_transactions: Number(r.total_transactions ?? 0),
        transactions_missing_purchase_cost: Number(
          r.transactions_missing_purchase_cost ?? 0
        ),
        transactions_estimated: Number(r.transactions_estimated ?? 0),
        is_locked: !!p.is_locked,
      };
    })
    .filter((r): r is VatPeriodRow => r !== null);

  rows.sort((a, b) => a.start_date.localeCompare(b.start_date));

  const totals = rows.reduce(
    (acc, r) => {
      acc.total_sales_amount = round2(
        acc.total_sales_amount + r.total_sales_amount
      );
      acc.total_purchase_cost_amount = round2(
        acc.total_purchase_cost_amount + r.total_purchase_cost_amount
      );
      acc.value_added_amount = round2(
        acc.value_added_amount + r.value_added_amount
      );
      acc.taxable_value_added = round2(
        acc.taxable_value_added + r.taxable_value_added
      );
      acc.vat_amount = round2(acc.vat_amount + r.vat_amount);
      acc.transactions_estimated += r.transactions_estimated;
      return acc;
    },
    {
      total_sales_amount: 0,
      total_purchase_cost_amount: 0,
      value_added_amount: 0,
      taxable_value_added: 0,
      vat_amount: 0,
      transactions_estimated: 0,
    }
  );

  return { range, rows, totals };
}

export type CarryForwardRow = VatPeriodRow & {
  consumed_in_period: number;
};

export type CarryForwardReport = {
  range: ReportRange;
  rows: CarryForwardRow[];
  totals: {
    negative_carried_in: number;
    negative_carried_out: number;
    consumed_in_period: number;
    vat_amount: number;
  };
};

export async function loadCarryForwardReport(
  client: DBClient,
  range: ReportRange
): Promise<CarryForwardReport> {
  const base = await loadVatPayableReport(client, range);

  const rows: CarryForwardRow[] = base.rows
    .map((r) => {
      const consumed =
        r.value_added_amount >= 0
          ? Math.max(0, r.negative_carried_in - r.negative_carried_out)
          : 0;
      return { ...r, consumed_in_period: round2(consumed) };
    })
    .filter(
      (r) =>
        r.negative_carried_in > 0 ||
        r.negative_carried_out > 0 ||
        r.consumed_in_period > 0
    );

  const totals = rows.reduce(
    (acc, r) => {
      acc.negative_carried_in = round2(
        acc.negative_carried_in + r.negative_carried_in
      );
      acc.negative_carried_out = round2(
        acc.negative_carried_out + r.negative_carried_out
      );
      acc.consumed_in_period = round2(
        acc.consumed_in_period + r.consumed_in_period
      );
      acc.vat_amount = round2(acc.vat_amount + r.vat_amount);
      return acc;
    },
    {
      negative_carried_in: 0,
      negative_carried_out: 0,
      consumed_in_period: 0,
      vat_amount: 0,
    }
  );

  return { range, rows, totals };
}
