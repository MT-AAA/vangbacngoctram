import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { toChi } from "@/lib/reports/weight";

type DBClient = SupabaseClient<Database>;

const round2 = (n: number) => Math.round(n * 100) / 100;

export type TimeBasedCostResult = {
  available_weight: number;
  available_cost: number;
  average_unit_cost: number;
  sale_weight: number;
  sale_cost: number;
};

export async function calculateTimeBasedInventoryCost(
  client: DBClient,
  args: {
    storeId: string;
    categoryId: string;
    saleDate: string;
    saleWeight: number | null;
    saleWeightUnit?: string | null;
    saleQuantity: number;
    excludeSaleId?: string | null;
  }
): Promise<TimeBasedCostResult> {
  const saleWeight = args.saleWeight && args.saleWeight > 0
    ? toChi(args.saleWeight, args.saleWeightUnit ?? "chỉ")
    : Number(args.saleQuantity ?? 0);

  if (!Number.isFinite(saleWeight) || saleWeight <= 0) {
    throw new Error("Giao dịch bán thiếu khối lượng để tính giá vốn theo thời gian");
  }

  const { data: movements, error } = await client
    .from("inventory_movements")
    .select("source_type, source_id, movement_date, weight_delta, cost_delta")
    .eq("store_id", args.storeId)
    .eq("product_category_id", args.categoryId)
    .lte("movement_date", args.saleDate)
    .order("movement_date", { ascending: true });

  if (error) throw new Error(error.message);

  const relevantMovements = (movements ?? []).filter(
    (movement) =>
      !(
        args.excludeSaleId &&
        movement.source_type === "sale" &&
        movement.source_id === args.excludeSaleId
      )
  );

  const availableWeight = relevantMovements.reduce(
    (sum, movement) => sum + Number(movement.weight_delta ?? 0),
    0
  );
  const availableCost = relevantMovements.reduce(
    (sum, movement) => sum + Number(movement.cost_delta ?? 0),
    0
  );
  if (availableWeight <= 0 || availableCost <= 0) {
    throw new Error("Không đủ dữ liệu tồn kho tại ngày bán để tính giá vốn");
  }
  if (saleWeight > availableWeight + 1e-6) {
    throw new Error("Khối lượng bán lớn hơn tồn kho tại ngày bán");
  }

  const avg = availableCost / availableWeight;
  return {
    available_weight: round2(availableWeight),
    available_cost: round2(availableCost),
    average_unit_cost: round2(avg),
    sale_weight: round2(saleWeight),
    sale_cost: round2(saleWeight * avg),
  };
}
