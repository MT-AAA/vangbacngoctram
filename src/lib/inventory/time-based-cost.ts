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

  const [{ data: openingRows, error: openingErr }, { data: purchases, error: purchaseErr }, { data: soldRows, error: soldErr }] = await Promise.all([
    client
      .from("inventory_items")
      .select("initial_weight, current_weight, purchase_cost_amount, source_reference, imported_at")
      .eq("store_id", args.storeId)
      .eq("product_category_id", args.categoryId)
      .or("source_reference.eq.TONDAU-Q2-2026,source_reference.ilike.POOL-%"),
    client
      .from("customer_purchases")
      .select("id, weight, weight_unit, quantity, total_amount, purchase_date, becomes_inventory")
      .eq("store_id", args.storeId)
      .eq("product_category_id", args.categoryId)
      .eq("becomes_inventory", true)
      .lte("purchase_date", args.saleDate),
    client
      .from("sales_transactions")
      .select("id, weight, weight_unit, quantity, purchase_cost_amount, sale_date")
      .eq("store_id", args.storeId)
      .eq("product_category_id", args.categoryId)
      .eq("purchase_cost_source", "inventory")
      .lt("sale_date", args.saleDate),
  ]);

  if (openingErr) throw new Error(openingErr.message);
  if (purchaseErr) throw new Error(purchaseErr.message);
  if (soldErr) throw new Error(soldErr.message);

  const inventoryRows = openingRows ?? [];
  const explicitOpening = inventoryRows.filter((r) =>
    r.source_reference?.startsWith("TONDAU")
  );
  const pooledOpening = inventoryRows.filter((r) =>
    r.source_reference?.startsWith("POOL-")
  );
  const opening = explicitOpening.length > 0 ? explicitOpening : pooledOpening;
  const openingWeight = opening.reduce((sum, r) => sum + Number(r.initial_weight ?? r.current_weight ?? 0), 0);
  const openingCost = opening.reduce((sum, r) => sum + Number(r.purchase_cost_amount ?? 0), 0);

  const purchaseWeight = (purchases ?? []).reduce((sum, r) => {
    const weight = r.weight ? toChi(Number(r.weight), r.weight_unit ?? "chỉ") : Number(r.quantity ?? 0);
    return sum + Number(weight || 0);
  }, 0);
  const purchaseCost = (purchases ?? []).reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0);

  const soldBefore = (soldRows ?? []).filter((r) => r.id !== args.excludeSaleId);
  const soldWeight = soldBefore.reduce((sum, r) => {
    const weight = r.weight ? toChi(Number(r.weight), r.weight_unit ?? "chỉ") : Number(r.quantity ?? 0);
    return sum + Number(weight || 0);
  }, 0);
  const soldCost = soldBefore.reduce((sum, r) => sum + Number(r.purchase_cost_amount ?? 0), 0);

  const availableWeight = openingWeight + purchaseWeight - soldWeight;
  const availableCost = openingCost + purchaseCost - soldCost;
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
