import test from "node:test";
import assert from "node:assert/strict";

import { findDuplicateGroups, findReconciliationWarnings } from "../queries";

/**
 * `queries.ts` only depends on the supabase client for two methods:
 *   * `client.from('sales_transactions').select(...).not(...).order(...).order(...).limit(...)`
 *   * `client.from('import_files').select(...).order(...).limit(...)`
 *
 * The test stubs return precomputed rows so we can verify the JS-side
 * grouping logic without spinning up Supabase.
 */
function fakeClient<T>(rowsByTable: Record<string, T[]>) {
  return {
    from(table: string) {
      const data = rowsByTable[table] ?? [];
      const builder = {
        select() {
          return builder;
        },
        not() {
          return builder;
        },
        neq() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return Promise.resolve({ data });
        },
      };
      return builder;
    },
  } as unknown as Parameters<typeof findDuplicateGroups>[0];
}

test("findDuplicateGroups detects same product line repeated within an invoice", async () => {
  const rows = [
    {
      id: "a",
      invoice_key: "K1",
      invoice_no: "001",
      product_name_raw: "Vàng",
      unit: "chỉ",
      quantity: 1,
      unit_price: 100,
      total_amount: 100,
    },
    {
      id: "b",
      invoice_key: "K1",
      invoice_no: "001",
      product_name_raw: "Vàng",
      unit: "chỉ",
      quantity: 1,
      unit_price: 100,
      total_amount: 100,
    },
    {
      id: "c",
      invoice_key: "K2",
      invoice_no: "002",
      product_name_raw: "Bạc",
      unit: "chỉ",
      quantity: 1,
      unit_price: 50,
      total_amount: 50,
    },
  ];
  const client = fakeClient({ sales_transactions: rows });
  const { groups, count } = await findDuplicateGroups(client);
  const within = groups.filter((g) => g.kind === "duplicate_within_invoice");
  assert.equal(within.length, 1, "one within-invoice duplicate group");
  assert.equal(within[0].count, 2);
  assert.equal(count, groups.length);
});

test("findDuplicateGroups flags shared invoice_no across invoice_keys", async () => {
  const rows = [
    {
      id: "a",
      invoice_key: "K1",
      invoice_no: "777",
      product_name_raw: "Vàng",
      unit: "chỉ",
      quantity: 1,
      unit_price: 100,
      total_amount: 100,
    },
    {
      id: "b",
      invoice_key: "K2",
      invoice_no: "777",
      product_name_raw: "Lắc tay",
      unit: "chỉ",
      quantity: 2,
      unit_price: 200,
      total_amount: 400,
    },
  ];
  const client = fakeClient({ sales_transactions: rows });
  const { groups } = await findDuplicateGroups(client);
  const shared = groups.filter((g) => g.kind === "shared_invoice_no");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].count, 2);
  assert.equal(shared[0].invoice_no, "777");
  assert.equal(shared[0].total_amount, 500);
});

test("findReconciliationWarnings flags failed imports and partial commits", async () => {
  const imports = [
    {
      id: "i1",
      file_name: "ok.xlsx",
      created_at: "2026-04-01",
      status: "completed",
      total_rows: 100,
      inserted_rows: 100,
      updated_rows: 0,
      error_rows: 0,
      transaction_line_count: 100,
      unique_invoice_count: 95,
      total_amount: 1000,
      period_start: "2026-01-01",
      period_end: "2026-03-31",
    },
    {
      id: "i2",
      file_name: "fail.xlsx",
      created_at: "2026-04-02",
      status: "failed",
      total_rows: 100,
      inserted_rows: 0,
      updated_rows: 0,
      error_rows: 5,
      transaction_line_count: 100,
      unique_invoice_count: 0,
      total_amount: 0,
      period_start: null,
      period_end: null,
    },
    {
      id: "i3",
      file_name: "partial.xlsx",
      created_at: "2026-04-03",
      status: "completed",
      total_rows: 100,
      inserted_rows: 95,
      updated_rows: 0,
      error_rows: 0,
      transaction_line_count: 100,
      unique_invoice_count: 90,
      total_amount: 999,
      period_start: "2026-04-01",
      period_end: "2026-04-30",
    },
  ];
  const client = fakeClient({ import_files: imports });
  const { rows, count } = await findReconciliationWarnings(client);
  assert.equal(count, 2, "ok.xlsx is excluded, fail and partial included");
  assert.equal(rows.length, 2);
  const ids = rows.map((r) => r.id).sort();
  assert.deepEqual(ids, ["i2", "i3"]);
  const partial = rows.find((r) => r.id === "i3");
  assert.ok(partial && partial.warnings.some((w) => w.includes("95/100")));
});

test("findReconciliationWarnings returns count-only when onlyCount is true", async () => {
  const imports = [
    {
      id: "i2",
      file_name: "fail.xlsx",
      created_at: "2026-04-02",
      status: "failed",
      total_rows: 100,
      inserted_rows: 0,
      updated_rows: 0,
      error_rows: 5,
      transaction_line_count: 100,
      unique_invoice_count: 0,
      total_amount: 0,
      period_start: null,
      period_end: null,
    },
  ];
  const client = fakeClient({ import_files: imports });
  const { rows, count } = await findReconciliationWarnings(client, {
    onlyCount: true,
  });
  assert.equal(count, 1);
  assert.equal(rows.length, 0);
});
