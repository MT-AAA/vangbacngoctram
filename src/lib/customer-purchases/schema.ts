/**
 * Shared zod schemas + constants for the manual customer-purchases module.
 *
 * Used by:
 *   * `/api/customer-purchases/*` route handlers (validation)
 *   * The `/customer-purchases` form components (typed defaults / labels)
 *   * Server data layer for filter parsing
 */

import { z } from "zod";

export const PURITY_OPTIONS = [
  "9999",
  "24K",
  "18K",
  "14K",
  "10K",
  "925",
  "other",
] as const;
export type Purity = (typeof PURITY_OPTIONS)[number];

export const PURITY_LABELS: Record<Purity, string> = {
  "9999": "Vàng 9999",
  "24K": "Vàng 24K",
  "18K": "Vàng 18K",
  "14K": "Vàng 14K",
  "10K": "Vàng 10K",
  "925": "Bạc 925",
  other: "Khác",
};

export const UNIT_OPTIONS = ["chỉ", "lượng", "gram", "cái", "đôi"] as const;
export type Unit = (typeof UNIT_OPTIONS)[number];

/**
 * The form sends an empty string for "no value" on optional text fields. This
 * helper trims and converts those to null so the DB doesn't store empty
 * strings.
 */
const emptyToNull = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  });

const optionalUuid = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  })
  .pipe(z.string().uuid().nullable());

const optionalPurity = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  })
  .pipe(z.enum(PURITY_OPTIONS).nullable());

const requiredText = (label: string) =>
  z
    .string({ message: `${label} không hợp lệ` })
    .trim()
    .min(1, `${label} là bắt buộc`);

const positiveNumber = z
  .number({ message: "Giá trị phải là số" })
  .finite("Giá trị phải là số")
  .nonnegative("Giá trị không được âm");

/** Body schema accepted by POST /api/customer-purchases. */
export const customerPurchaseCreateSchema = z.object({
  purchase_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày mua không hợp lệ"),
  customer_name: emptyToNull,
  customer_phone: emptyToNull,
  customer_tax_code: emptyToNull,
  customer_id_card: emptyToNull,
  customer_address: emptyToNull,
  product_name: requiredText("Tên sản phẩm"),
  product_category_id: optionalUuid,
  purity: optionalPurity,
  unit: emptyToNull,
  weight: z
    .union([z.number(), z.null(), z.undefined()])
    .transform((v) => (v === undefined ? null : v))
    .pipe(z.number().finite().nonnegative().nullable()),
  weight_unit: z.string().trim().min(1).default("chỉ"),
  quantity: positiveNumber,
  unit_buy_price: positiveNumber,
  total_buy_amount: positiveNumber,
  is_tax_purchase_input: z.boolean(),
  add_to_inventory: z.boolean(),
  notes: emptyToNull,
  image_url: emptyToNull,
  attachment_url: emptyToNull,
});

/** Body schema for PATCH /api/customer-purchases/[id] — same fields, all optional. */
export const customerPurchaseUpdateSchema =
  customerPurchaseCreateSchema.partial();

export type CustomerPurchaseCreateInput = z.infer<
  typeof customerPurchaseCreateSchema
>;
export type CustomerPurchaseUpdateInput = z.infer<
  typeof customerPurchaseUpdateSchema
>;
