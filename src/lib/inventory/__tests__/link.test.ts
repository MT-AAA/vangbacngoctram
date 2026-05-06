import test from "node:test";
import assert from "node:assert/strict";

import { computeLink, InventoryLinkError } from "../link";

const baseSale = {
  id: "sale-1",
  store_id: "store-1",
  quantity: 1,
  weight: 1,
  total_amount: 8_000_000,
  purchase_cost_amount: null,
  purchase_cost_source: "unknown" as const,
  product_category_id: "cat-1",
};

const baseInventory = {
  id: "inv-1",
  store_id: "store-1",
  product_category_id: "cat-1",
  current_quantity: 1,
  current_weight: 1,
  initial_weight: 1,
  purchase_unit_price: 7_000_000,
  purchase_cost_amount: 7_000_000,
  status: "in_stock" as const,
  is_tax_cost_source: true,
};

test("computeLink: full consumption uses inventory.purchase_cost_amount", () => {
  const c = computeLink({
    sale: { ...baseSale, weight: 1 },
    inventory: { ...baseInventory },
  });
  assert.equal(c.cost, 7_000_000);
  assert.equal(c.fullyConsumed, true);
  assert.equal(c.newStatus, "sold");
  assert.equal(c.weightDelta, 1);
});

test("computeLink: partial consumption uses unit_price * sold weight", () => {
  const c = computeLink({
    sale: { ...baseSale, weight: 0.5, quantity: 1 },
    inventory: { ...baseInventory, current_weight: 1.5, initial_weight: 1.5 },
  });
  assert.equal(c.cost, 3_500_000); // 0.5 * 7,000,000
  assert.equal(c.fullyConsumed, false);
  assert.equal(c.newStatus, "partially_sold");
  assert.equal(c.weightDelta, 0.5);
  assert.equal(c.qtyDelta, 0); // weight-mode keeps qty intact
});

test("computeLink: derives unit_price when missing", () => {
  const c = computeLink({
    sale: { ...baseSale, weight: 0.75 },
    inventory: {
      ...baseInventory,
      purchase_unit_price: null,
      purchase_cost_amount: 9_000_000,
      initial_weight: 1.5,
      current_weight: 1.5,
    },
  });
  // unit price derived = 9,000,000 / 1.5 = 6,000,000 → 0.75 * 6,000,000 = 4,500,000
  assert.equal(c.cost, 4_500_000);
});

test("computeLink: refuses linking to archived inventory", () => {
  assert.throws(
    () =>
      computeLink({
        sale: baseSale,
        inventory: { ...baseInventory, status: "archived" },
      }),
    InventoryLinkError
  );
});

test("computeLink: refuses linking to sold inventory", () => {
  assert.throws(
    () =>
      computeLink({
        sale: baseSale,
        inventory: { ...baseInventory, status: "sold" },
      }),
    InventoryLinkError
  );
});

test("computeLink: rejects when sale weight exceeds inventory weight", () => {
  assert.throws(
    () =>
      computeLink({
        sale: { ...baseSale, weight: 5 },
        inventory: { ...baseInventory, current_weight: 1, initial_weight: 1 },
      }),
    InventoryLinkError
  );
});

test("computeLink: rejects when inventory not flagged as cost source", () => {
  assert.throws(
    () =>
      computeLink({
        sale: baseSale,
        inventory: { ...baseInventory, is_tax_cost_source: false },
      }),
    InventoryLinkError
  );
});

test("computeLink: warns when categories differ", () => {
  const c = computeLink({
    sale: { ...baseSale, product_category_id: "cat-A" },
    inventory: { ...baseInventory, product_category_id: "cat-B" },
  });
  assert.equal(c.warnings.length, 1);
  assert.match(c.warnings[0]!, /Phân loại/);
});

test("computeLink: quantity-mode partial consumption", () => {
  const c = computeLink({
    sale: { ...baseSale, weight: null, quantity: 1 },
    inventory: {
      ...baseInventory,
      current_quantity: 3,
      current_weight: 0,
      initial_weight: null,
    },
  });
  // No weight info; falls back to purchase_cost_amount / qty as "per piece" estimate
  // 7,000,000 / 3 ≈ 2,333,333.33, rounded to 2 decimals
  assert.ok(c.cost > 2_300_000 && c.cost < 2_350_000);
  assert.equal(c.qtyDelta, 1);
  assert.equal(c.fullyConsumed, false);
});

test("computeLink: full quantity consumption marks sold", () => {
  const c = computeLink({
    sale: { ...baseSale, weight: null, quantity: 3 },
    inventory: {
      ...baseInventory,
      current_quantity: 3,
      current_weight: 0,
    },
  });
  assert.equal(c.cost, 7_000_000);
  assert.equal(c.fullyConsumed, true);
  assert.equal(c.newStatus, "sold");
});
