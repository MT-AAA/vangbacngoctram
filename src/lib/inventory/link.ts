/**
 * Linking an `inventory_items` row to a `sales_transactions` row so the sale
 * gets a real purchase cost from a specific stock piece. This is the
 * "Gắn với tồn kho" workflow on the missing-cost issues screen.
 *
 * The math (Phase 2G spec):
 *
 *   sold weight  ≥  inventory.current_weight   → cost = inventory.purchase_cost_amount
 *                                                 (we consume the whole piece)
 *   sold weight  <  inventory.current_weight   → cost = sold_weight × inventory.purchase_unit_price
 *
 * If `purchase_unit_price` is missing but `purchase_cost_amount` and
 * `initial_weight` exist we derive it as `purchase_cost_amount / initial_weight`.
 *
 * After updating the sale we decrement `current_quantity` / `current_weight`
 * on the inventory row and flip its status to `partially_sold` (or `sold` if
 * fully consumed).
 *
 * The DB trigger on `sales_transactions` recomputes `value_added_amount`
 * automatically when we set `purchase_cost_amount`, but for clarity we set
 * it explicitly too.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type AdminClient = SupabaseClient<Database>;

export type LinkContext = {
  sale: {
    id: string;
    store_id: string;
    quantity: number;
    weight: number | null;
    total_amount: number;
    purchase_cost_amount: number | null;
    purchase_cost_source: Database["public"]["Enums"]["purchase_cost_source"] | null;
    product_category_id: string | null;
  };
  inventory: {
    id: string;
    store_id: string;
    product_category_id: string | null;
    current_quantity: number | null;
    current_weight: number | null;
    initial_weight: number | null;
    purchase_unit_price: number | null;
    purchase_cost_amount: number | null;
    status: Database["public"]["Enums"]["inventory_status"];
    is_tax_cost_source: boolean;
  };
};

export type LinkComputation = {
  cost: number;
  qtyDelta: number;
  weightDelta: number | null;
  newStatus: Database["public"]["Enums"]["inventory_status"];
  fullyConsumed: boolean;
  warnings: string[];
};

export class InventoryLinkError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "InventoryLinkError";
  }
}

export function computeLink(ctx: LinkContext): LinkComputation {
  const { sale, inventory } = ctx;
  const warnings: string[] = [];

  if (!inventory.is_tax_cost_source) {
    throw new InventoryLinkError(
      "Mặt hàng tồn này không dùng làm giá vốn"
    );
  }
  if (
    inventory.status === "archived" ||
    inventory.status === "sold" ||
    inventory.status === "written_off"
  ) {
    throw new InventoryLinkError(
      "Không thể gắn với mặt hàng đã lưu trữ hoặc đã bán hết"
    );
  }

  if (sale.product_category_id && inventory.product_category_id) {
    if (sale.product_category_id !== inventory.product_category_id) {
      warnings.push(
        "Phân loại của giao dịch khác phân loại của mặt hàng tồn"
      );
    }
  }

  // Resolve unit price (might be derived).
  let unitPrice = inventory.purchase_unit_price;
  if (
    (unitPrice === null || unitPrice === undefined || unitPrice <= 0) &&
    inventory.purchase_cost_amount !== null &&
    inventory.initial_weight !== null &&
    inventory.initial_weight > 0
  ) {
    unitPrice = inventory.purchase_cost_amount / inventory.initial_weight;
  }

  const currentQty = Number(inventory.current_quantity ?? 0);
  const currentWeight = Number(inventory.current_weight ?? 0);
  const saleQty = Number(sale.quantity ?? 0);
  const saleWeight = sale.weight === null || sale.weight === undefined
    ? null
    : Number(sale.weight);

  // Decide consumption mode: weight-based when both sides have weight, qty otherwise.
  const useWeight =
    saleWeight !== null && saleWeight > 0 && currentWeight > 0;

  let cost = 0;
  let qtyDelta = 0;
  let weightDelta: number | null = null;
  let fullyConsumed = false;

  if (useWeight) {
    if (saleWeight! > currentWeight) {
      throw new InventoryLinkError(
        "Khối lượng giao dịch lớn hơn khối lượng tồn kho hiện có"
      );
    }
    if (saleWeight! >= currentWeight - 1e-6) {
      // consume whole piece
      cost = Number(inventory.purchase_cost_amount ?? 0);
      qtyDelta = currentQty;
      weightDelta = currentWeight;
      fullyConsumed = true;
    } else {
      if (!unitPrice || unitPrice <= 0) {
        throw new InventoryLinkError(
          "Mặt hàng tồn thiếu giá mua đơn vị, không thể tính giá vốn từng phần"
        );
      }
      cost = saleWeight! * unitPrice;
      qtyDelta = 0;
      weightDelta = saleWeight!;
      fullyConsumed = false;
    }
  } else {
    if (saleQty <= 0) {
      throw new InventoryLinkError("Số lượng giao dịch không hợp lệ");
    }
    if (saleQty > currentQty) {
      throw new InventoryLinkError(
        "Số lượng giao dịch lớn hơn số lượng tồn kho hiện có"
      );
    }
    if (saleQty >= currentQty - 1e-9) {
      cost = Number(inventory.purchase_cost_amount ?? 0);
      qtyDelta = currentQty;
      weightDelta = currentWeight > 0 ? currentWeight : null;
      fullyConsumed = true;
    } else {
      if (!unitPrice || unitPrice <= 0) {
        throw new InventoryLinkError(
          "Mặt hàng tồn thiếu giá mua đơn vị, không thể tính giá vốn từng phần"
        );
      }
      // qty-based: assume each piece weighs initial_weight / initial_quantity
      const perPieceWeight =
        currentWeight > 0 && currentQty > 0
          ? currentWeight / currentQty
          : 0;
      cost = perPieceWeight > 0
        ? saleQty * perPieceWeight * unitPrice
        : saleQty * (Number(inventory.purchase_cost_amount ?? 0) / Math.max(currentQty, 1));
      qtyDelta = saleQty;
      weightDelta = perPieceWeight > 0 ? perPieceWeight * saleQty : null;
      fullyConsumed = false;
    }
  }

  if (!Number.isFinite(cost) || cost < 0) {
    throw new InventoryLinkError("Không thể tính giá vốn từ mặt hàng tồn này");
  }

  const newStatus: Database["public"]["Enums"]["inventory_status"] =
    fullyConsumed ? "sold" : "partially_sold";

  return {
    cost: round2(cost),
    qtyDelta,
    weightDelta,
    newStatus,
    fullyConsumed,
    warnings,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Persist a link: update sales_transactions + inventory_items in two
 * round-trips. We don't wrap them in a transaction because Supabase REST
 * doesn't expose that — but the DB triggers keep value_added_amount in sync
 * even if the second write fails.
 */
export async function persistLink(
  admin: AdminClient,
  ctx: LinkContext,
  computation: LinkComputation
): Promise<void> {
  const newQuantity = Math.max(
    0,
    Number(ctx.inventory.current_quantity ?? 0) - computation.qtyDelta
  );
  const newWeight =
    computation.weightDelta === null
      ? ctx.inventory.current_weight
      : Math.max(
          0,
          Number(ctx.inventory.current_weight ?? 0) - computation.weightDelta
        );

  const { error: invErr } = await admin
    .from("inventory_items")
    .update({
      current_quantity: newQuantity,
      current_weight: newWeight,
      quantity_on_hand: newQuantity,
      weight: newWeight,
      status: computation.newStatus,
    })
    .eq("id", ctx.inventory.id)
    .eq("store_id", ctx.inventory.store_id);

  if (invErr) {
    throw new InventoryLinkError(
      `Không cập nhật được tồn kho: ${invErr.message}`,
      500
    );
  }

  const valueAdded = Number(ctx.sale.total_amount ?? 0) - computation.cost;
  const { error: saleErr } = await admin
    .from("sales_transactions")
    .update({
      linked_inventory_item_id: ctx.inventory.id,
      purchase_cost_amount: computation.cost,
      purchase_cost_source: "inventory",
      value_added_amount: valueAdded,
      tax_calculation_status: "complete",
    })
    .eq("id", ctx.sale.id)
    .eq("store_id", ctx.sale.store_id);

  if (saleErr) {
    throw new InventoryLinkError(
      `Không cập nhật được giao dịch bán: ${saleErr.message}`,
      500
    );
  }
}
