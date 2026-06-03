/**
 * Inventory linking helpers for the customer-purchases module.
 *
 * When the cashier checks "đưa vào tồn kho" (add_to_inventory) on a manual
 * customer purchase, we want a corresponding `inventory_items` row so the
 * stock screen and the per-category inventory snapshot reflect the new piece
 * the shop just bought from the customer.
 *
 * The DB enforces the linkage in both directions:
 *   * `customer_purchases.inventory_item_id` → inventory_items.id
 *     (the purchase row that "fed" stock)
 *   * `inventory_items.source_customer_purchase_id` → customer_purchases.id
 *     (the inventory row's provenance)
 *
 * `ensureInventoryItemForPurchase` is idempotent: if a linked inventory_items
 * row already exists for this purchase it updates that row in place instead
 * of creating a new one. This means edits to the customer purchase (renaming
 * the product, adjusting weight/price, swapping category) flow through to the
 * inventory row automatically.
 *
 * `removeInventoryLink` clears the link in both directions but does NOT
 * delete the inventory row outright — the shop may have already partially
 * sold it. The cashier can hard-delete the inventory item from the inventory
 * UI later if they really want to.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { recordInventoryMovement } from "@/lib/inventory/movements";

type AdminClient = SupabaseClient<Database>;

export type InventoryLinkInput = {
  store_id: string;
  purchase_id: string;
  product_name: string;
  product_category_id: string | null;
  quantity: number;
  weight: number | null;
  weight_unit: string;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  created_by: string;
  purchase_date?: string | null;
};

async function findAveragePool(
  admin: AdminClient,
  input: { store_id: string; product_category_id: string; product_name?: string }
) {
  const { data: category } = await admin
    .from("product_categories")
    .select("id, name, code")
    .eq("id", input.product_category_id)
    .eq("store_id", input.store_id)
    .maybeSingle();

  if (!category) {
    throw new Error("Không tìm thấy nhóm hàng để cộng vào rổ tồn kho");
  }

  const poolReference = `POOL-${String(category.code ?? category.name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()}`;
  const poolName = `Tồn kho bình quân - ${category.name}`;

  const { data: existingPools } = await admin
    .from("inventory_items")
    .select(
      "id, current_quantity, current_weight, initial_quantity, initial_weight, purchase_cost_amount"
    )
    .eq("store_id", input.store_id)
    .eq("product_category_id", input.product_category_id)
    .eq("name", poolName)
    .eq("is_tax_cost_source", true)
    .not("status", "in", "(archived,sold)")
    .order("created_at", { ascending: true })
    .limit(1);

  return { category, poolName, poolReference, existingPool: existingPools?.[0] ?? null };
}

async function applyPurchaseInventoryDelta(
  admin: AdminClient,
  input: InventoryLinkInput & {
    inventory_item_id?: string | null;
    quantity_delta: number;
    weight_delta: number;
    cost_delta: number;
    movement_note?: string | null;
  }
): Promise<{ inventory_item_id: string }> {
  if (!input.product_category_id) {
    throw new Error("Cần phân loại Vàng ta / Vàng tây / Bạc trước khi đưa vào tồn kho");
  }

  const { poolName, poolReference, existingPool } = await findAveragePool(admin, {
    store_id: input.store_id,
    product_category_id: input.product_category_id,
  });

  let inventoryId = input.inventory_item_id ?? existingPool?.id ?? null;

  if (!inventoryId) {
    const unitCost = input.weight_delta > 0 ? input.cost_delta / input.weight_delta : input.unit_cost;
    const { data: inserted } = await admin
      .from("inventory_items")
      .insert({
        store_id: input.store_id,
        product_category_id: input.product_category_id,
        name: poolName,
        quantity_on_hand: input.quantity_delta,
        current_quantity: input.quantity_delta,
        initial_quantity: input.quantity_delta,
        weight: input.weight_delta,
        current_weight: input.weight_delta,
        initial_weight: input.weight_delta,
        weight_unit: input.weight_unit,
        unit: input.weight_unit,
        unit_cost: unitCost,
        purchase_unit_price: unitCost > 0 ? unitCost : null,
        total_cost: input.cost_delta,
        purchase_cost_amount: input.cost_delta > 0 ? input.cost_delta : null,
        status: "in_stock",
        notes: "Rổ tồn kho bình quân, tự động cộng từ mua khách.",
        source_customer_purchase_id: input.purchase_id,
        source_type: "customer_purchase",
        source_id: input.purchase_id,
        source_reference: poolReference,
        is_tax_cost_source: true,
        created_by: input.created_by,
      })
      .select("id")
      .single();

    if (!inserted) throw new Error("Không tạo được rổ tồn kho bình quân");
    inventoryId = inserted.id;
  } else {
    const pool = existingPool?.id === inventoryId ? existingPool : null;
    const currentQuantity = Number(pool?.current_quantity ?? 0);
    const currentWeight = Number(pool?.current_weight ?? 0);
    const currentCost = Number(pool?.purchase_cost_amount ?? 0);
    const initialQuantity = Number(pool?.initial_quantity ?? 0);
    const initialWeight = Number(pool?.initial_weight ?? 0);
    const newQuantity = Math.max(0, currentQuantity + input.quantity_delta);
    const newWeight = Math.max(0, currentWeight + input.weight_delta);
    const newInitialQuantity = Math.max(0, initialQuantity + input.quantity_delta);
    const newInitialWeight = Math.max(0, initialWeight + input.weight_delta);
    const newCost = Math.max(0, currentCost + input.cost_delta);
    const newUnitCost = newWeight > 0 ? newCost / newWeight : undefined;

    await admin
      .from("inventory_items")
      .update({
        name: poolName,
        quantity_on_hand: newQuantity,
        current_quantity: newQuantity,
        initial_quantity: newInitialQuantity,
        weight: newWeight,
        current_weight: newWeight,
        initial_weight: newInitialWeight,
        unit_cost: newUnitCost,
        purchase_unit_price: newUnitCost,
        total_cost: newCost,
        purchase_cost_amount: newCost > 0 ? newCost : null,
        status: "in_stock",
        notes: "Rổ tồn kho bình quân, tự động cộng từ mua khách.",
        source_type: "customer_purchase",
        source_id: input.purchase_id,
        source_reference: poolReference,
        is_tax_cost_source: true,
      })
      .eq("id", inventoryId);
  }

  await admin
    .from("customer_purchases")
    .update({ inventory_item_id: inventoryId })
    .eq("id", input.purchase_id);

  await recordInventoryMovement(admin, {
    store_id: input.store_id,
    product_category_id: input.product_category_id,
    inventory_item_id: inventoryId,
    source_type: "customer_purchase",
    source_id: input.purchase_id,
    source_label: input.product_name,
    movement_date: input.purchase_date ?? new Date().toISOString(),
    weight_delta: input.weight_delta,
    quantity_delta: input.quantity_delta,
    cost_delta: input.cost_delta,
    unit_cost:
      input.weight_delta !== 0
        ? Math.abs(input.cost_delta / input.weight_delta)
        : input.unit_cost || undefined,
    note: input.movement_note ?? input.notes,
    created_by: input.created_by,
  });

  return { inventory_item_id: inventoryId };
}

export async function ensureInventoryItemForPurchase(
  admin: AdminClient,
  input: InventoryLinkInput
): Promise<{ inventory_item_id: string }> {
  const quantity = Number(input.quantity ?? 0);
  const weight = Number(input.weight ?? 0);
  const cost = Number(input.total_cost ?? 0);

  return applyPurchaseInventoryDelta(admin, {
    ...input,
    quantity_delta: quantity,
    weight_delta: weight,
    cost_delta: cost,
  });
}

export async function reconcileInventoryItemForPurchase(
  admin: AdminClient,
  before: InventoryLinkInput & { inventory_item_id?: string | null },
  after: InventoryLinkInput
): Promise<{ inventory_item_id: string }> {
  if (before.product_category_id && before.product_category_id !== after.product_category_id && before.inventory_item_id) {
    await applyPurchaseInventoryDelta(admin, {
      ...before,
      quantity_delta: -Number(before.quantity ?? 0),
      weight_delta: -Number(before.weight ?? 0),
      cost_delta: -Number(before.total_cost ?? 0),
      movement_note: "Đảo tồn kho do đổi phân loại mua từ khách",
    });
    return ensureInventoryItemForPurchase(admin, after);
  }

  return applyPurchaseInventoryDelta(admin, {
    ...after,
    inventory_item_id: before.inventory_item_id ?? null,
    quantity_delta: Number(after.quantity ?? 0) - Number(before.quantity ?? 0),
    weight_delta: Number(after.weight ?? 0) - Number(before.weight ?? 0),
    cost_delta: Number(after.total_cost ?? 0) - Number(before.total_cost ?? 0),
    movement_note: "Điều chỉnh chênh lệch mua từ khách",
  });
}

export async function removeInventoryLink(
  admin: AdminClient,
  purchaseId: string,
  removedBy?: string | null
): Promise<{
  inventory_item_id: string | null;
  product_category_id: string | null;
  purchase_date: string | null;
}> {
  const { data: purchase } = await admin
    .from("customer_purchases")
    .select(
      "id, store_id, inventory_item_id, product_category_id, product_name, quantity, weight, weight_unit, total_amount, unit_price, purchase_date, notes"
    )
    .eq("id", purchaseId)
    .maybeSingle();

  const inventoryId = purchase?.inventory_item_id ?? null;
  if (!purchase || !inventoryId) {
    return { inventory_item_id: null, product_category_id: null, purchase_date: null };
  }

  await applyPurchaseInventoryDelta(admin, {
    store_id: purchase.store_id,
    purchase_id: purchase.id,
    product_name: purchase.product_name,
    product_category_id: purchase.product_category_id,
    quantity: Number(purchase.quantity ?? 0),
    weight: purchase.weight === null ? null : Number(purchase.weight),
    weight_unit: purchase.weight_unit,
    unit_cost: Number(purchase.unit_price ?? 0),
    total_cost: Number(purchase.total_amount ?? 0),
    notes: purchase.notes ?? null,
    created_by: removedBy ?? "",
    purchase_date: purchase.purchase_date,
    inventory_item_id: inventoryId,
    quantity_delta: -Number(purchase.quantity ?? 0),
    weight_delta: -Number(purchase.weight ?? 0),
    cost_delta: -Number(purchase.total_amount ?? 0),
    movement_note: purchase.notes ? `Xóa mua từ khách: ${purchase.notes}` : "Xóa mua từ khách",
  });

  await admin
    .from("customer_purchases")
    .update({ inventory_item_id: null })
    .eq("id", purchaseId);

  return {
    inventory_item_id: inventoryId,
    product_category_id: purchase.product_category_id,
    purchase_date: purchase.purchase_date,
  };
}
