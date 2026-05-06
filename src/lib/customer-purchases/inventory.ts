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
};

export async function ensureInventoryItemForPurchase(
  admin: AdminClient,
  input: InventoryLinkInput
): Promise<{ inventory_item_id: string }> {
  const { data: purchase } = await admin
    .from("customer_purchases")
    .select("inventory_item_id")
    .eq("id", input.purchase_id)
    .maybeSingle();

  const existingId = purchase?.inventory_item_id ?? null;

  if (existingId) {
    await admin
      .from("inventory_items")
      .update({
        store_id: input.store_id,
        product_category_id: input.product_category_id,
        name: input.product_name,
        quantity_on_hand: input.quantity,
        weight: input.weight,
        weight_unit: input.weight_unit,
        unit_cost: input.unit_cost,
        total_cost: input.total_cost,
        notes: input.notes,
        source_customer_purchase_id: input.purchase_id,
      })
      .eq("id", existingId);
    return { inventory_item_id: existingId };
  }

  const { data: inserted } = await admin
    .from("inventory_items")
    .insert({
      store_id: input.store_id,
      product_category_id: input.product_category_id,
      name: input.product_name,
      quantity_on_hand: input.quantity,
      weight: input.weight,
      weight_unit: input.weight_unit,
      unit_cost: input.unit_cost,
      total_cost: input.total_cost,
      status: "in_stock",
      notes: input.notes,
      source_customer_purchase_id: input.purchase_id,
      created_by: input.created_by,
    })
    .select("id")
    .single();

  if (!inserted) {
    throw new Error("Không tạo được mặt hàng tồn kho");
  }

  await admin
    .from("customer_purchases")
    .update({ inventory_item_id: inserted.id })
    .eq("id", input.purchase_id);

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
