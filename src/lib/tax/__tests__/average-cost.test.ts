import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateAverages,
  projectAffectedRows,
} from "../average-cost";

const NAME_BY_ID = new Map<string | null, string>([
  ["cat-vang-ta", "Vàng ta"],
  ["cat-vang-tay", "Vàng tây"],
  ["cat-bac", "Bạc"],
  [null, "Chưa phân loại"],
]);

test("aggregateAverages: empty input → empty output", () => {
  assert.deepEqual(aggregateAverages([], NAME_BY_ID), []);
});

test("aggregateAverages: groups by category and computes weighted average", () => {
  const result = aggregateAverages(
    [
      // Vàng ta: 10,000,000 / 2 = 5,000,000 per chỉ
      { product_category_id: "cat-vang-ta", total_amount: 6_000_000, quantity: 1 },
      { product_category_id: "cat-vang-ta", total_amount: 4_000_000, quantity: 1 },
      // Bạc: 1,500,000 / 5 = 300,000 per chỉ
      { product_category_id: "cat-bac", total_amount: 1_500_000, quantity: 5 },
    ],
    NAME_BY_ID
  );

  const vt = result.find((r) => r.category_id === "cat-vang-ta");
  const bac = result.find((r) => r.category_id === "cat-bac");
  assert.ok(vt && bac);
  assert.equal(vt.total_purchase_amount, 10_000_000);
  assert.equal(vt.total_purchase_quantity, 2);
  assert.equal(vt.average_purchase_price, 5_000_000);
  assert.equal(vt.source_purchase_count, 2);
  assert.equal(bac.average_purchase_price, 300_000);
  assert.equal(bac.source_purchase_count, 1);
});

test("aggregateAverages: skips zero / negative quantity to avoid divide-by-zero", () => {
  const result = aggregateAverages(
    [
      { product_category_id: "cat-vang-ta", total_amount: 6_000_000, quantity: 1 },
      { product_category_id: "cat-vang-ta", total_amount: 4_000_000, quantity: 0 },
      { product_category_id: "cat-vang-ta", total_amount: 0, quantity: 1 },
    ],
    NAME_BY_ID
  );
  const vt = result.find((r) => r.category_id === "cat-vang-ta");
  assert.ok(vt);
  assert.equal(vt.total_purchase_amount, 6_000_000);
  assert.equal(vt.total_purchase_quantity, 1);
  assert.equal(vt.average_purchase_price, 6_000_000);
});

test("aggregateAverages: bucket for null category is named 'Chưa phân loại'", () => {
  const result = aggregateAverages(
    [{ product_category_id: null, total_amount: 100_000, quantity: 1 }],
    NAME_BY_ID
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].category_id, null);
  assert.equal(result[0].category_name, "Chưa phân loại");
});

test("projectAffectedRows: estimates cost for rows with matching category", () => {
  const averages = aggregateAverages(
    [
      { product_category_id: "cat-vang-ta", total_amount: 5_000_000, quantity: 1 },
    ],
    NAME_BY_ID
  );

  const rows = projectAffectedRows(
    [
      {
        id: "sale-1",
        sale_date: "2026-02-15",
        invoice_no: "1",
        invoice_series: "K22T",
        product_name_raw: "Nhẫn vàng 9999",
        product_category_id: "cat-vang-ta",
        quantity: 2,
        total_amount: 12_000_000,
      },
      // Should be skipped (category has no average)
      {
        id: "sale-2",
        sale_date: "2026-02-15",
        invoice_no: "2",
        invoice_series: null,
        product_name_raw: "Bông tai bạc",
        product_category_id: "cat-bac",
        quantity: 1,
        total_amount: 200_000,
      },
      // Should be skipped (no category)
      {
        id: "sale-3",
        sale_date: "2026-02-15",
        invoice_no: "3",
        invoice_series: null,
        product_name_raw: "Mặt hàng lạ",
        product_category_id: null,
        quantity: 1,
        total_amount: 100_000,
      },
    ],
    averages
  );

  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.id, "sale-1");
  assert.equal(r.estimated_purchase_cost, 10_000_000); // 2 × 5,000,000
  assert.equal(r.estimated_value_added, 2_000_000); // 12M - 10M
  assert.equal(r.category_name, "Vàng ta");
});

test("projectAffectedRows: skips rows with zero quantity", () => {
  const averages = aggregateAverages(
    [
      { product_category_id: "cat-vang-ta", total_amount: 5_000_000, quantity: 1 },
    ],
    NAME_BY_ID
  );

  const rows = projectAffectedRows(
    [
      {
        id: "sale-1",
        sale_date: "2026-02-15",
        invoice_no: "1",
        invoice_series: null,
        product_name_raw: "x",
        product_category_id: "cat-vang-ta",
        quantity: 0,
        total_amount: 0,
      },
    ],
    averages
  );
  assert.equal(rows.length, 0);
});

test("projectAffectedRows: handles fractional quantities", () => {
  const averages = aggregateAverages(
    [
      { product_category_id: "cat-vang-tay", total_amount: 4_500_000, quantity: 1.5 },
    ],
    NAME_BY_ID
  );
  // average = 3,000,000

  const rows = projectAffectedRows(
    [
      {
        id: "sale-1",
        sale_date: "2026-02-15",
        invoice_no: "1",
        invoice_series: null,
        product_name_raw: "Lắc tay vàng tây 10K",
        product_category_id: "cat-vang-tay",
        quantity: 0.5,
        total_amount: 2_000_000,
      },
    ],
    averages
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].estimated_purchase_cost, 1_500_000);
  assert.equal(rows[0].estimated_value_added, 500_000);
});
