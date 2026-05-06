import { createHash } from "crypto";
import type { ParsedRow } from "./parse";

/**
 * Two stable identifiers for Vietnamese e-invoice rows.
 *
 * Why two identifiers?
 *
 * One e-invoice can contain many product rows. We must NOT collapse them on
 * import — so the per-line dedupe key (`transaction_hash`) is line-scoped, and
 * a separate per-invoice grouping key (`invoice_key`) lets reconciliation /
 * reporting query "all rows for this invoice".
 *
 * The hash is SHA-256 truncated to 32 hex chars (128 bits) — enough entropy
 * for stable dedupe; short enough to fit comfortably in indexes.
 */

function sha256_128(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function normPart(v: string | null | undefined): string {
  return (v ?? "").toString().trim();
}

export type InvoiceKeyInput = {
  store_id: string;
  invoice_series: string | null;
  invoice_no: string | null;
  tax_authority_code: string | null;
};

/**
 * Build a stable invoice-grouping key.
 *
 *   invoice_key = sha256(store_id | invoice_series | invoice_no |
 *                        tax_authority_code) [first 128 bits]
 *
 * `store_id` is included so two different stores cannot collide on the same
 * invoice number. `tax_authority_code` is included so a re-issued invoice (new
 * `Mã CQT cấp`) is treated as a new invoice rather than overwriting the old.
 *
 * If both `invoice_no` and `tax_authority_code` are missing, returns a hash of
 * `store_id` alone, which keeps the function deterministic but means callers
 * should treat the result with caution (only the truly-anonymous case).
 */
export function invoiceKey(input: InvoiceKeyInput): string {
  return sha256_128([
    "v1",
    normPart(input.store_id),
    normPart(input.invoice_series),
    normPart(input.invoice_no),
    normPart(input.tax_authority_code),
  ]);
}

export type TransactionHashInput = {
  invoice_key: string;
  source_stt: number | null;
  product_name_raw: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
};

/**
 * Build a stable per-line dedupe hash.
 *
 *   transaction_hash = sha256(invoice_key | source_stt | product_name_raw |
 *                             unit | quantity | unit_price | total_amount)
 *
 * `source_stt` is included to distinguish two physically identical product
 * rows on the same invoice (rare but possible). If a re-export shifts STT
 * numbering, the same line will receive a different hash and be inserted as a
 * new row — that is acceptable because the alternative (omitting STT) collapses
 * legitimate duplicates.
 */
export function transactionHash(input: TransactionHashInput): string {
  return sha256_128([
    "t1",
    normPart(input.invoice_key),
    input.source_stt === null ? "" : String(input.source_stt),
    normPart(input.product_name_raw).toLowerCase().replace(/\s+/g, " "),
    normPart(input.unit).toLowerCase(),
    input.quantity === null ? "" : String(input.quantity),
    input.unit_price === null ? "" : String(input.unit_price),
    input.total_amount === null ? "" : String(input.total_amount),
  ]);
}

/**
 * Build both keys for a parsed row in one call. `store_id` must be passed in
 * by the caller (the parser is store-agnostic).
 */
export function rowIdentifiers(
  storeId: string,
  row: ParsedRow
): { invoice_key: string; transaction_hash: string } {
  const ik = invoiceKey({
    store_id: storeId,
    invoice_series: row.invoice_series,
    invoice_no: row.invoice_no,
    tax_authority_code: row.tax_authority_code,
  });
  const th = transactionHash({
    invoice_key: ik,
    source_stt: row.source_stt,
    product_name_raw: row.product_name_raw,
    unit: row.unit,
    quantity: row.quantity,
    unit_price: row.unit_price,
    total_amount: row.total_amount,
  });
  return { invoice_key: ik, transaction_hash: th };
}
