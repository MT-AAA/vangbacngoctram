/**
 * Zod schemas + helpers for the Phase 2G inventory module.
 *
 * The form on `/inventory` (and the POST/PATCH API) accept Vietnamese-locale
 * decimal strings for quantities, weights and prices. We re-use the
 * `parseVietnameseNumber` helper that the rest of the app uses so the user
 * can type "1,5" and we still hit numeric(14,4) cleanly.
 */

import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { parseVietnameseNumber } from "@/lib/utils";

export const INVENTORY_STATUSES = [
  "in_stock",
  "partially_sold",
  "sold",
  "melted",
  "returned",
  "adjusted",
  "archived",
  // legacy values still allowed for backward compat
  "reserved",
  "written_off",
] as const satisfies ReadonlyArray<
  Database["public"]["Enums"]["inventory_status"]
>;

export const INVENTORY_SOURCE_TYPES = [
  "manual",
  "customer_purchase",
  "supplier",
  "adjustment",
  "excel_import",
] as const satisfies ReadonlyArray<
  Database["public"]["Enums"]["inventory_source_type"]
>;

export const STATUS_LABELS: Record<
  Database["public"]["Enums"]["inventory_status"],
  string
> = {
  in_stock: "Còn hàng",
  partially_sold: "Đã bán 1 phần",
  sold: "Đã bán hết",
  melted: "Đã nấu",
  returned: "Đã trả",
  adjusted: "Đã điều chỉnh",
  archived: "Đã lưu trữ",
  reserved: "Đặt giữ",
  written_off: "Xoá sổ",
};

export const SOURCE_LABELS: Record<
  Database["public"]["Enums"]["inventory_source_type"],
  string
> = {
  manual: "Nhập tay",
  customer_purchase: "Mua từ khách",
  supplier: "Nhập từ NCC",
  adjustment: "Điều chỉnh",
  excel_import: "Excel",
};

/**
 * SKU pattern: NGOCTRAM-{CODE}-YYYYMMDD-NNNN. We only validate it loosely on
 * the client because the DB function is the source of truth for new rows.
 */
export const SKU_PATTERN = /^NGOCTRAM-[A-Z0-9]+-\d{8}-\d{4,}$/;

const decimal = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number")
      return Number.isFinite(v) ? v : (ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Số không hợp lệ" }), z.NEVER);
    const n = parseVietnameseNumber(v);
    if (n === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Số không hợp lệ" });
      return z.NEVER;
    }
    return n;
  });

export const inventoryCreateSchema = z.object({
  product_name: z.string().trim().min(1, "Tên hàng bắt buộc"),
  category_id: z
    .string()
    .uuid("Phân loại không hợp lệ")
    .min(1, "Phân loại bắt buộc"),
  sku: z.string().trim().optional().nullable(),
  product_type: z.string().trim().optional().nullable(),
  purity: z.string().trim().optional().nullable(),
  unit: z.string().trim().optional().nullable(),
  weight_unit: z.string().trim().optional().nullable(),

  initial_quantity: decimal,
  current_quantity: decimal,
  initial_weight: decimal,
  current_weight: decimal,

  purchase_unit_price: decimal,
  purchase_cost_amount: decimal,
  selling_price: decimal,

  source_type: z.enum(INVENTORY_SOURCE_TYPES).default("manual"),
  source_reference: z.string().trim().optional().nullable(),

  status: z.enum(INVENTORY_STATUSES).default("in_stock"),
  is_tax_cost_source: z.boolean().default(true),
  imported_at: z.string().optional().nullable(),
  note: z.string().trim().optional().nullable(),
  attachment_url: z.string().trim().optional().nullable(),
});
export type InventoryCreateInput = z.infer<typeof inventoryCreateSchema>;

export const inventoryUpdateSchema = inventoryCreateSchema.partial();
export type InventoryUpdateInput = z.infer<typeof inventoryUpdateSchema>;

export const inventoryArchiveSchema = z.object({
  reason: z.string().trim().min(1, "Nhập lý do lưu trữ").max(500),
});
export type InventoryArchiveInput = z.infer<typeof inventoryArchiveSchema>;

export const inventoryLinkSaleSchema = z.object({
  sale_id: z.string().uuid(),
  inventory_item_id: z.string().uuid(),
  override_manual_cost: z.boolean().default(false),
});
export type InventoryLinkSaleInput = z.infer<typeof inventoryLinkSaleSchema>;

/**
 * Validation: a row that wants `is_tax_cost_source = true` must have a
 * `purchase_cost_amount`. We validate this at the API layer so the DB stays
 * permissive (legacy rows might come in without one).
 */
export function ensureCostForTaxSource(
  input: Partial<{
    is_tax_cost_source: boolean | null;
    purchase_cost_amount: number | null;
  }>
): string | null {
  if (input.is_tax_cost_source === false) return null;
  if (input.purchase_cost_amount === null || input.purchase_cost_amount === undefined) {
    return "Hàng dùng làm giá vốn bắt buộc phải có giá mua vào";
  }
  if (!Number.isFinite(input.purchase_cost_amount) || input.purchase_cost_amount < 0) {
    return "Giá mua vào không hợp lệ";
  }
  return null;
}
