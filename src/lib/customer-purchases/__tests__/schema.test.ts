import test from "node:test";
import assert from "node:assert/strict";

import {
  customerPurchaseCreateSchema,
  customerPurchaseUpdateSchema,
} from "../schema";

const validBase = {
  purchase_date: "2026-05-01",
  customer_name: "Khách lẻ A",
  customer_phone: "0900000000",
  customer_tax_code: "",
  customer_id_card: "001234567890",
  customer_address: "",
  product_name: "Nhẫn vàng 9999",
  product_category_id: null,
  purity: "9999",
  unit: "chỉ",
  weight: 1.5,
  weight_unit: "chỉ",
  quantity: 1,
  unit_buy_price: 6500000,
  total_buy_amount: 6500000,
  is_tax_purchase_input: true,
  add_to_inventory: true,
  notes: "",
  image_url: "",
  attachment_url: "",
};

test("customerPurchaseCreateSchema accepts a valid manual purchase", () => {
  const result = customerPurchaseCreateSchema.safeParse(validBase);
  assert.equal(result.success, true);
  assert.equal(result.data?.product_name, "Nhẫn vàng 9999");
  assert.equal(result.data?.purity, "9999");
});

test("empty optional text fields normalize to null", () => {
  const result = customerPurchaseCreateSchema.parse(validBase);
  assert.equal(result.customer_tax_code, null);
  assert.equal(result.notes, null);
  assert.equal(result.image_url, null);
  assert.equal(result.attachment_url, null);
});

test("invalid purchase_date is rejected", () => {
  const result = customerPurchaseCreateSchema.safeParse({
    ...validBase,
    purchase_date: "2026/05/01",
  });
  assert.equal(result.success, false);
});

test("missing product_name is rejected", () => {
  const result = customerPurchaseCreateSchema.safeParse({
    ...validBase,
    product_name: "",
  });
  assert.equal(result.success, false);
});

test("negative amount is rejected", () => {
  const result = customerPurchaseCreateSchema.safeParse({
    ...validBase,
    total_buy_amount: -1,
  });
  assert.equal(result.success, false);
});

test("invalid purity tag is rejected", () => {
  const result = customerPurchaseCreateSchema.safeParse({
    ...validBase,
    purity: "999",
  });
  assert.equal(result.success, false);
});

test("decimal quantity is preserved", () => {
  const result = customerPurchaseCreateSchema.parse({
    ...validBase,
    quantity: 1.5,
  });
  assert.equal(result.quantity, 1.5);
});

test("update schema accepts a partial body", () => {
  const result = customerPurchaseUpdateSchema.safeParse({
    is_tax_purchase_input: false,
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.is_tax_purchase_input, false);
});
