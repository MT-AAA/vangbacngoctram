/**
 * Inventory-related data quality counts surfaced on the "Cần xử lý" screen.
 *
 *   - missing_cost     → inventory_items where the row is supposed to be a
 *                        tax-cost source (`is_tax_cost_source = true`) but no
 *                        purchase_cost_amount has been entered yet.
 *   - missing_category → inventory_items with no product_category_id.
 *   - negative_stock   → inventory_items where current_quantity < 0 OR
 *                        current_weight < 0 (data entry error).
 *   - linked_archived  → sales_transactions whose linked_inventory_item_id
 *                        points at an inventory row that's now archived or
 *                        sold (=> the cost source is no longer authoritative).
 *
 * The shape of the return mirrors `loadIssueCounts` from
 * `src/lib/issues/data.ts` so it can be merged into the existing UI.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

export type InventoryIssueCounts = {
  missingCost: number;
  missingCategory: number;
  negativeStock: number;
  linkedToArchived: number;
  total: number;
};

export async function loadInventoryIssueCounts(
  client: DBClient
): Promise<InventoryIssueCounts> {
  const [missingCostRes, missingCatRes, negativeRes, linkedRows] =
    await Promise.all([
      client
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .is("purchase_cost_amount", null)
        .eq("is_tax_cost_source", true)
        .not("status", "in", "(archived,sold)"),
      client
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .is("product_category_id", null)
        .not("status", "in", "(archived,sold)"),
      client
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .or("current_quantity.lt.0,current_weight.lt.0"),
      client
        .from("sales_transactions")
        .select(
          "id, linked_inventory_item_id, inventory:inventory_items!sales_transactions_linked_inventory_item_id_fkey(status)"
        )
        .not("linked_inventory_item_id", "is", null),
    ]);

  let linkedToArchived = 0;
  for (const row of (linkedRows.data ?? []) as Array<{
    inventory:
      | { status: Database["public"]["Enums"]["inventory_status"] }
      | { status: Database["public"]["Enums"]["inventory_status"] }[]
      | null;
  }>) {
    const inv = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
    if (!inv) continue;
    if (inv.status === "archived" || inv.status === "sold") {
      linkedToArchived += 1;
    }
  }

  const missingCost = missingCostRes.count ?? 0;
  const missingCategory = missingCatRes.count ?? 0;
  const negativeStock = negativeRes.count ?? 0;

  return {
    missingCost,
    missingCategory,
    negativeStock,
    linkedToArchived,
    total: missingCost + missingCategory + negativeStock + linkedToArchived,
  };
}
