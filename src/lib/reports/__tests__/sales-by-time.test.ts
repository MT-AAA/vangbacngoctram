import test from "node:test";
import { strict as assert } from "node:assert";
import { bucketizeSales, type SalesRow } from "../sales-by-time";
import { bucketize } from "../range";

const buckets = bucketize("month", "2026-01-01", "2026-03-31");

const rows: SalesRow[] = [
  // January
  {
    sale_date: "2026-01-05",
    total_amount: 1000,
    purchase_cost_amount: 700,
    value_added_amount: 300,
    tax_calculation_status: "complete",
  },
  {
    sale_date: "2026-01-20",
    total_amount: 500,
    purchase_cost_amount: 200,
    value_added_amount: 300,
    tax_calculation_status: "estimated",
  },
  // February (no rows)
  // March
  {
    sale_date: "2026-03-31",
    total_amount: 2000,
    purchase_cost_amount: 1500,
    value_added_amount: 500,
    tax_calculation_status: "complete",
  },
  // out-of-range — should be ignored
  {
    sale_date: "2025-12-31",
    total_amount: 9999,
    purchase_cost_amount: 0,
    value_added_amount: 9999,
    tax_calculation_status: "complete",
  },
];

test("bucketizeSales: aggregates by bucket and counts estimated", () => {
  const out = bucketizeSales(rows, buckets);
  assert.equal(out.length, 3);

  // January
  assert.equal(out[0].label, "T01/2026");
  assert.equal(out[0].transaction_count, 2);
  assert.equal(out[0].total_sales_amount, 1500);
  assert.equal(out[0].total_purchase_cost_amount, 900);
  assert.equal(out[0].value_added_amount, 600);
  assert.equal(out[0].transactions_estimated, 1);

  // February (empty)
  assert.equal(out[1].label, "T02/2026");
  assert.equal(out[1].transaction_count, 0);
  assert.equal(out[1].total_sales_amount, 0);

  // March
  assert.equal(out[2].label, "T03/2026");
  assert.equal(out[2].transaction_count, 1);
  assert.equal(out[2].total_sales_amount, 2000);
  assert.equal(out[2].value_added_amount, 500);
  assert.equal(out[2].transactions_estimated, 0);
});

test("bucketizeSales: returns empty buckets array unchanged", () => {
  const out = bucketizeSales([], buckets);
  assert.equal(out.length, 3);
  for (const b of out) {
    assert.equal(b.transaction_count, 0);
    assert.equal(b.total_sales_amount, 0);
    assert.equal(b.value_added_amount, 0);
  }
});

test("bucketizeSales: falls back to total - cost when value_added is null", () => {
  const buckets = bucketize("month", "2026-01-01", "2026-01-31");
  const rows: SalesRow[] = [
    {
      sale_date: "2026-01-15",
      total_amount: 1000,
      purchase_cost_amount: 400,
      value_added_amount: null,
      tax_calculation_status: "complete",
    },
  ];
  const out = bucketizeSales(rows, buckets);
  assert.equal(out[0].value_added_amount, 600);
});
