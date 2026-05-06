import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parseSalesExcel, parseInvoiceDate } from "../parse";
import { invoiceKey, transactionHash, rowIdentifiers } from "../hash";
import { classifyProduct, type ClassificationRule } from "../../classification";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIXTURE_PATH = join(
  __dirname,
  "fixtures",
  "2803122425_Bao_cao_ban_hang_chi_tiet_2026-01-01_2026-03-31.xlsx"
);

function loadFixture(): ArrayBuffer {
  const buf = readFileSync(FIXTURE_PATH);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Phase 2A acceptance criteria — real Vàng Bạc Ngọc Trâm Q1 2026 export
// ---------------------------------------------------------------------------

test("parses the real sales export with expected aggregate counts", async () => {
  const parsed = await parseSalesExcel(loadFixture());

  // 406 transaction lines.
  assert.equal(parsed.data_row_count, 406, "data_row_count");
  assert.equal(parsed.rows.length, 406, "rows.length");
  assert.equal(parsed.total_rows, 406, "total_rows");

  // total_amount = 6,919,680,000 VND.
  assert.equal(parsed.total_amount, 6_919_680_000, "total_amount VND");

  // Date range 2026-01-03 → 2026-03-30.
  assert.equal(parsed.period_start, "2026-01-03", "period_start");
  assert.equal(parsed.period_end, "2026-03-30", "period_end");

  // 341 unique invoice keys (in the parser we count by (series, no, taxcode);
  // hash collisions are then asserted in the next test).
  assert.equal(parsed.unique_invoice_count, 341, "unique_invoice_count");

  // No row-level errors expected in this clean export.
  const errored = parsed.rows.filter((r) => r.errors.length > 0);
  assert.equal(errored.length, 0, "rows with errors should be 0");

  // Header detected at row 8.
  assert.equal(parsed.header_row_number, 8, "header_row_number");

  // Summary row "Tổng cộng:" must NOT appear in the data rows. We verify by
  // checking that no row's source_row_number is the summary row index (417)
  // and that no product_name_raw equals "Tổng cộng:".
  const sttSet = new Set(parsed.rows.map((r) => r.source_stt));
  assert.ok(!sttSet.has(null), "no rows with null STT");
  for (const r of parsed.rows) {
    assert.notEqual(r.source_row_number, 417, "summary row 417 must not appear");
    assert.notEqual(
      r.product_name_raw,
      "Tổng cộng:",
      `product_name_raw should not be the summary marker`
    );
  }
});

test("preserves multi-line invoices (one e-invoice can contain many product rows)", async () => {
  const parsed = await parseSalesExcel(loadFixture());

  // Group rows by raw invoice_no — the spec invariant is that 406 lines map
  // to 341 unique invoices, so some invoice numbers must repeat.
  const byNo = new Map<string, number>();
  for (const r of parsed.rows) {
    const key = r.invoice_no ?? "";
    byNo.set(key, (byNo.get(key) ?? 0) + 1);
  }
  const multi = Array.from(byNo.entries()).filter(([, n]) => n > 1);
  assert.ok(multi.length > 0, "expected at least one multi-line invoice");

  // Specifically: invoice 74 in the fixture has 2 rows (Vàng tây 10k + Dây bạc).
  assert.equal(byNo.get("74"), 2, "invoice 74 should have 2 product lines");
});

test("Số lượng decimal values are preserved (1.5 must stay 1.5, not 15)", async () => {
  const parsed = await parseSalesExcel(loadFixture());

  // The fixture contains a row at STT=4 with quantity=1.5.
  const decimalRow = parsed.rows.find((r) => r.source_stt === 4);
  assert.ok(decimalRow, "row with STT=4 should exist");
  assert.equal(decimalRow!.quantity, 1.5, "quantity should be 1.5, not 15");
});

test("invoice_date parses Vietnamese dd/MM/yyyy HH:mm without falling back to US format", async () => {
  // E.g. "03/01/2026 16:06" must be 2026-01-03T16:06, not 2026-03-01.
  assert.equal(parseInvoiceDate("03/01/2026 16:06"), "2026-01-03T16:06:00");
  assert.equal(parseInvoiceDate("06/01/2026 17:51"), "2026-01-06T17:51:00");
  assert.equal(parseInvoiceDate("30/03/2026 10:54"), "2026-03-30T10:54:00");
  // Date-only fallback.
  assert.equal(parseInvoiceDate("01/12/2025"), "2025-12-01");
});

test("vat_output_amount_from_invoice is captured per row but is 0 in this direct-method export", async () => {
  const parsed = await parseSalesExcel(loadFixture());

  // The Phase 2A spec requires this column to be stored verbatim from the
  // invoice. In this gold/silver export every row has VAT=0 (direct method).
  for (const r of parsed.rows.slice(0, 50)) {
    assert.equal(
      r.vat_output_amount_from_invoice,
      0,
      `row STT=${r.source_stt} vat_output_amount_from_invoice should be 0 for direct method`
    );
  }
});

// ---------------------------------------------------------------------------
// Hash invariants
// ---------------------------------------------------------------------------

test("invoice_key + transaction_hash satisfy 341/406 acceptance criterion", async () => {
  const parsed = await parseSalesExcel(loadFixture());
  const STORE_ID = "00000000-0000-0000-0000-000000000001";

  const invoiceKeys = new Set<string>();
  const txHashes = new Set<string>();
  for (const r of parsed.rows) {
    const ids = rowIdentifiers(STORE_ID, r);
    invoiceKeys.add(ids.invoice_key);
    txHashes.add(ids.transaction_hash);
  }

  assert.equal(invoiceKeys.size, 341, "unique invoice_key count");
  assert.equal(txHashes.size, 406, "unique transaction_hash count");
});

test("invoice_key is stable for the same (store_id, series, no, tax_authority_code)", () => {
  const a = invoiceKey({
    store_id: "store-A",
    invoice_series: "C26MNT",
    invoice_no: "100",
    tax_authority_code: "M2-26-LUDWQ-00000000100",
  });
  const b = invoiceKey({
    store_id: "store-A",
    invoice_series: "C26MNT",
    invoice_no: "100",
    tax_authority_code: "M2-26-LUDWQ-00000000100",
  });
  assert.equal(a, b);

  // Different store ⇒ different invoice_key.
  const c = invoiceKey({
    store_id: "store-B",
    invoice_series: "C26MNT",
    invoice_no: "100",
    tax_authority_code: "M2-26-LUDWQ-00000000100",
  });
  assert.notEqual(a, c);
});

test("transaction_hash differs per product line within the same invoice", () => {
  const ik = invoiceKey({
    store_id: "store-A",
    invoice_series: "C26MNT",
    invoice_no: "74",
    tax_authority_code: "M2-26-LUDWQ-00000000075",
  });
  const t1 = transactionHash({
    invoice_key: ik,
    source_stt: 74,
    product_name_raw: "Dây chuyền vàng tây 10k",
    unit: "chỉ",
    quantity: 1.5,
    unit_price: 7_400_000,
    total_amount: 11_100_000,
  });
  const t2 = transactionHash({
    invoice_key: ik,
    source_stt: 75,
    product_name_raw: "Dây bạc",
    unit: "chỉ",
    quantity: 5,
    unit_price: 400_000,
    total_amount: 2_000_000,
  });
  assert.notEqual(t1, t2);
});

// ---------------------------------------------------------------------------
// Classification — ambiguous names per spec
// ---------------------------------------------------------------------------

const SAMPLE_RULES: ClassificationRule[] = [
  { id: "1", category_id: "bac", keyword: "bạc", priority: 10, is_active: true },
  { id: "2", category_id: "bac", keyword: "bac", priority: 10, is_active: true },
  { id: "3", category_id: "vang_tay", keyword: "18k", priority: 20, is_active: true },
  { id: "4", category_id: "vang_tay", keyword: "14k", priority: 20, is_active: true },
  { id: "5", category_id: "vang_tay", keyword: "10k", priority: 20, is_active: true },
  { id: "6", category_id: "vang_tay", keyword: "vàng tây", priority: 20, is_active: true },
  { id: "7", category_id: "vang_tay", keyword: "vang tay", priority: 20, is_active: true },
  { id: "8", category_id: "vang_tay", keyword: "tây", priority: 25, is_active: true },
  { id: "9", category_id: "vang_ta", keyword: "9999", priority: 30, is_active: true },
  { id: "10", category_id: "vang_ta", keyword: "999", priority: 30, is_active: true },
  { id: "11", category_id: "vang_ta", keyword: "24k", priority: 30, is_active: true },
  { id: "12", category_id: "vang_ta", keyword: "vàng ta", priority: 30, is_active: true },
  { id: "13", category_id: "vang_ta", keyword: "vang ta", priority: 30, is_active: true },
];

test("classification — explicit Vàng tây / Vàng ta / Bạc names match", () => {
  assert.equal(
    classifyProduct("Dây chuyền vàng tây 10k", SAMPLE_RULES).category_id,
    "vang_tay"
  );
  assert.equal(
    classifyProduct("Vòng vàng ta 24k", SAMPLE_RULES).category_id,
    "vang_ta"
  );
  assert.equal(
    classifyProduct("Vàng ta", SAMPLE_RULES).category_id,
    "vang_ta"
  );
  assert.equal(
    classifyProduct("Lắc bạc thái", SAMPLE_RULES).category_id,
    "bac"
  );
});

test("classification — ambiguous names remain unclassified (Cần xử lý)", () => {
  // The spec calls these out specifically. They must not match any keyword.
  assert.equal(classifyProduct("Vàng", SAMPLE_RULES).category_id, null);
  assert.equal(classifyProduct("Lắc tay", SAMPLE_RULES).category_id, null);
  assert.equal(classifyProduct("Bông tai vàng", SAMPLE_RULES).category_id, null);
});
