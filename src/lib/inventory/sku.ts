/**
 * SKU helpers for inventory items.
 *
 * The DB function `next_inventory_sku(store_id, code)` is the authoritative
 * generator (atomic, per-day sequence). This file just maps the
 * `product_categories.code` value to the short SKU code requested by the
 * spec ('vang_ta' → 'VT', 'vang_tay' → 'VTAY', 'bac' → 'BAC').
 */

const CODE_MAP: Record<string, string> = {
  vang_ta: "VT",
  vang_tay: "VTAY",
  bac: "BAC",
};

export function categoryCodeToSkuCode(code: string | null | undefined): string {
  if (!code) return "SP";
  const lower = code.toLowerCase().trim();
  if (CODE_MAP[lower]) return CODE_MAP[lower];
  // Fallback: take the leading letters, uppercased and stripped of
  // anything non-alphanumeric. e.g. "kim_cuong" → "KIMCUONG".
  return lower.replace(/[^a-z0-9]+/g, "").toUpperCase() || "SP";
}
