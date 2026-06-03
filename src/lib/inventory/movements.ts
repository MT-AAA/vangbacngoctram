import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type InventoryMovementSource =
  | "opening_balance"
  | "customer_purchase"
  | "manual"
  | "sale"
  | "adjustment";

type AdminClient = SupabaseClient<Database>;

type MovementInput = {
  store_id: string;
  product_category_id: string;
  inventory_item_id?: string | null;
  source_type: InventoryMovementSource;
  source_id?: string | null;
  movement_event_id?: string | null;
  source_label?: string | null;
  movement_date: string;
  weight_delta: number;
  quantity_delta?: number;
  cost_delta: number;
  unit_cost?: number | null;
  note?: string | null;
  created_by?: string | null;
};

function toDateOnly(value: string): string {
  return value.includes("T") ? value.slice(0, 10) : value;
}

export async function recordInventoryMovement(
  admin: AdminClient,
  input: MovementInput
): Promise<void> {
  const { error } = await admin.from("inventory_movements").upsert(
    {
      store_id: input.store_id,
      product_category_id: input.product_category_id,
      inventory_item_id: input.inventory_item_id ?? null,
      source_type: input.source_type,
      source_id: input.movement_event_id ?? input.source_id ?? null,
      source_label: input.source_label ?? null,
      movement_date: toDateOnly(input.movement_date),
      weight_delta: input.weight_delta,
      quantity_delta: input.quantity_delta ?? input.weight_delta,
      cost_delta: input.cost_delta,
      unit_cost: input.unit_cost ?? null,
      note: input.note ?? null,
      created_by: input.created_by ?? null,
    },
    { onConflict: "store_id,source_type,source_id" }
  );

  if (error) {
    throw new Error(`Không ghi được phát sinh tồn kho: ${error.message}`);
  }
}
