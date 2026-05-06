/**
 * VAT direct-method engine for gold / silver / gemstone trading.
 *
 *   Value Added         = Sum(total_amount) - Sum(purchase_cost_amount)
 *   Negative carry-in   = unused negative VA from previous period(s) IN THE SAME CALENDAR YEAR
 *   Taxable VA          = max(0, Value Added - negative_carried_in)
 *                         (a positive VA is reduced by carry-in; a negative VA carries forward)
 *   VAT amount          = Taxable VA × VAT rate
 *   Negative carry-out  = absolute value of remaining negative position after offset
 *
 * At the end of the calendar year (last period of the year), remaining negative
 * value DOES NOT carry into the next year — it is dropped.
 *
 * The convention used in this codebase:
 *   - `negative_carried_in`  is stored as a positive number representing
 *     |unused negative VA from prior periods within the same year|.
 *   - `negative_carried_out` is stored as a positive number representing
 *     |unused negative VA leaving this period|.
 */

export type SalesAggregate = {
  total_sales_amount: number;
  total_purchase_cost_amount: number;
  total_transactions: number;
  transactions_missing_purchase_cost: number;
  transactions_estimated: number;
};

export type ComputeInput = {
  aggregate: SalesAggregate;
  /** Absolute value of negative VA carried in from prior periods this year. */
  negative_carried_in: number;
  vat_rate: number; // percent, e.g. 10 for 10%
};

export type ComputeResult = {
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
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeVAT(input: ComputeInput): ComputeResult {
  const { aggregate, negative_carried_in, vat_rate } = input;

  const value_added_amount = round2(
    aggregate.total_sales_amount - aggregate.total_purchase_cost_amount
  );

  let taxable_value_added = 0;
  let negative_carried_out = 0;

  if (value_added_amount >= 0) {
    // Positive VA: reduce by carry-in; remainder is taxable
    const offset = Math.min(value_added_amount, negative_carried_in);
    taxable_value_added = round2(value_added_amount - offset);
    negative_carried_out = round2(negative_carried_in - offset);
  } else {
    // Negative VA: carry-out grows by |VA|, taxable = 0
    taxable_value_added = 0;
    negative_carried_out = round2(negative_carried_in + Math.abs(value_added_amount));
  }

  const vat_amount = round2((taxable_value_added * vat_rate) / 100);

  return {
    total_sales_amount: round2(aggregate.total_sales_amount),
    total_purchase_cost_amount: round2(aggregate.total_purchase_cost_amount),
    value_added_amount,
    negative_carried_in: round2(negative_carried_in),
    taxable_value_added,
    vat_rate,
    vat_amount,
    negative_carried_out,
    total_transactions: aggregate.total_transactions,
    transactions_missing_purchase_cost: aggregate.transactions_missing_purchase_cost,
    transactions_estimated: aggregate.transactions_estimated,
  };
}

/**
 * Decide whether a period is the last one of its calendar year (so any
 * remaining negative_carried_out should NOT be considered for the next year).
 *
 * The caller is responsible for actually zeroing the carry-forward when a new
 * year begins; this helper just gives a UI hint.
 */
export function isYearClosingPeriod(period: { year: number; end_date: string }): boolean {
  const d = new Date(period.end_date);
  return d.getUTCFullYear() === period.year && d.getUTCMonth() === 11; // December
}
