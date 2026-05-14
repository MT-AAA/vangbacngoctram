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

export async function ensureInventoryItemForPurchase(
  admin: AdminClient,
  input: InventoryLinkInput
): Promise<{ inventory_item_id: string }> {
  if (!input.product_category_id) {
    throw new Error("Cần phân loại Vàng ta / Vàng tây / Bạc trước khi đưa vào tồn kho");
  }

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

  const existingPool = existingPools?.[0] ?? null;

  const addQuantity = Number(input.quantity ?? 0);
  const addWeight = Number(input.weight ?? 0);
  const addCost = Number(input.total_cost ?? 0);

  if (existingPool) {
    const currentQuantity = Number(existingPool.current_quantity ?? 0);
    const currentWeight = Number(existingPool.current_weight ?? 0);
    const currentCost = Number(existingPool.purchase_cost_amount ?? 0);
    const newQuantity = currentQuantity + addQuantity;
    const newWeight = currentWeight + addWeight;
    const newCost = currentCost + addCost;
    const newUnitCost = newWeight > 0 ? newCost / newWeight : input.unit_cost;

    await admin
      .from("inventory_items")
      .update({
        name: poolName,
        quantity_on_hand: newQuantity,
        current_quantity: newQuantity,
        initial_quantity: Number(existingPool.initial_quantity ?? 0) + addQuantity,
        weight: newWeight,
        current_weight: newWeight,
        initial_weight: Number(existingPool.initial_weight ?? 0) + addWeight,
        unit_cost: newUnitCost,
        purchase_unit_price: newUnitCost > 0 ? newUnitCost : null,
        total_cost: newCost,
        purchase_cost_amount: newCost > 0 ? newCost : null,
        status: "in_stock",
        notes: "Rổ tồn kho bình quân, tự động cộng từ mua khách.",
        source_type: "customer_purchase",
        source_id: input.purchase_id,
        source_reference: poolReference,
        is_tax_cost_source: true,
      })
      .eq("id", existingPool.id);

    await admin
      .from("customer_purchases")
      .update({ inventory_item_id: existingPool.id })
      .eq("id", input.purchase_id);

    await recordInventoryMovement(admin, {
      store_id: input.store_id,
      product_category_id: input.product_category_id,
      inventory_item_id: existingPool.id,
      source_type: "customer_purchase",
      source_id: input.purchase_id,
      source_label: input.product_name,
      movement_date: input.purchase_date ?? new Date().toISOString(),
      weight_delta: addWeight,
      quantity_delta: addQuantity,
      cost_delta: addCost,
      unit_cost: newUnitCost > 0 ? newUnitCost : null,
      note: input.notes,
      created_by: input.created_by,
    });

    return { inventory_item_id: existingPool.id };
  }

  const unitCost = addWeight > 0 ? addCost / addWeight : input.unit_cost;
  const { data: inserted } = await admin
    .from("inventory_items")
    .insert({
      store_id: input.store_id,
      product_category_id: input.product_category_id,
      name: poolName,
      quantity_on_hand: addQuantity,
      current_quantity: addQuantity,
      initial_quantity: addQuantity,
      weight: input.weight,
      current_weight: input.weight,
      initial_weight: input.weight,
      weight_unit: input.weight_unit,
      unit: input.weight_unit,
      unit_cost: unitCost,
      purchase_unit_price: unitCost > 0 ? unitCost : null,
      total_cost: addCost,
      purchase_cost_amount: addCost > 0 ? addCost : null,
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

  if (!inserted) {
    throw new Error("Không tạo được rổ tồn kho bình quân");
  }

  await admin
    .from("customer_purchases")
    .update({ inventory_item_id: inserted.id })
    .eq("id", input.purchase_id);

  await recordInventoryMovement(admin, {
    store_id: input.store_id,
    product_category_id: input.product_category_id,
    inventory_item_id: inserted.id,
    source_type: "customer_purchase",
    source_id: input.purchase_id,
    source_label: input.product_name,
    movement_date: input.purchase_date ?? new Date().toISOString(),
    weight_delta: addWeight,
    quantity_delta: addQuantity,
    cost_delta: addCost,
    unit_cost: unitCost > 0 ? unitCost : null,
    note: input.notes,
    created_by: input.created_by,
  });

  return { inventory_item_id: inserted.id };
}

export async function removeInventoryLink(
  admin: AdminClient,
  purchaseId: string
): Promise<void> {
  const { data: purchase } = await admin
    .from("customer_purchases")
    .select("inventory_item_id")
    .eq("id", purchaseId)
    .maybeSingle();

  const inventoryId = purchase?.inventory_item_id ?? null;
  if (!inventoryId) return;

  await admin
    .from("customer_purchases")
    .update({ inventory_item_id: null })
    .eq("id", purchaseId);

  await admin
    .from("inventory_items")
    .update({ source_customer_purchase_id: null })
    .eq("id", inventoryId);
}
