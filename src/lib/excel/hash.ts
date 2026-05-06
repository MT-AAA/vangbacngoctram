import { createHash } from "crypto";
import type { ParsedRow } from "./parse";

/**
 * Generate a stable transaction hash for dedupe.
 *
 * If `invoice_no` is present, use it directly (prefixed with "inv:" so it
 * cannot collide with hashed values).
 *
 * Otherwise hash the canonical fields:
 *   sale_date|product_name_raw|quantity|weight|unit_price|total_amount
 */
export function transactionHash(row: ParsedRow): string {
  if (row.invoice_no && row.invoice_no.trim()) {
    return `inv:${row.invoice_no.trim().toLowerCase()}`;
  }
  const parts = [
    row.sale_date ?? "",
    (row.product_name_raw ?? "").toLowerCase().trim().replace(/\s+/g, " "),
    String(row.quantity ?? ""),
    String(row.weight ?? ""),
    String(row.unit_price ?? ""),
    String(row.total_amount ?? ""),
  ];
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `h:${h.slice(0, 32)}`;
}
