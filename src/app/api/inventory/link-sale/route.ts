import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/inventory/api";
import { inventoryLinkSaleSchema } from "@/lib/inventory/schema";
import {
  computeLink,
  InventoryLinkError,
  persistLink,
  type LinkContext,
} from "@/lib/inventory/link";
import {
  cascadeRecalculateYear,
  recalculateTaxPeriod,
} from "@/lib/tax/recalculate";
import { calculateTimeBasedInventoryCost } from "@/lib/inventory/time-based-cost";
import { recordInventoryMovement } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Link an inventory item to a sales transaction. Computes the purchase cost
 * (full or partial), updates both rows, then re-runs the affected tax
 * period (and cascades carry-in for later periods in the same year).
 *
 * Body: { sale_id: uuid, inventory_item_id: uuid, override_manual_cost?: bool }
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin", "staff"]);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = inventoryLinkSaleSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const admin = createAdminClient();
  const [saleRes, invRes] = await Promise.all([
    admin
      .from("sales_transactions")
      .select(
        "id, store_id, sale_date, quantity, weight, weight_unit, total_amount, purchase_cost_amount, purchase_cost_source, product_category_id, linked_inventory_item_id"
      )
      .eq("id", input.sale_id)
      .eq("store_id", auth.profile.store_id)
      .maybeSingle(),
    admin
      .from("inventory_items")
      .select(
        "id, store_id, product_category_id, current_quantity, current_weight, initial_weight, purchase_unit_price, purchase_cost_amount, status, is_tax_cost_source"
      )
      .eq("id", input.inventory_item_id)
      .eq("store_id", auth.profile.store_id)
      .maybeSingle(),
  ]);

  const sale = saleRes.data;
  const inventory = invRes.data;
  if (!sale) {
    return NextResponse.json(
      { error: "Không tìm thấy giao dịch bán" },
      { status: 404 }
    );
  }
  if (!inventory) {
    return NextResponse.json(
      { error: "Không tìm thấy mặt hàng tồn kho" },
      { status: 404 }
    );
  }

  if (
    sale.purchase_cost_source === "manual" &&
    !input.override_manual_cost
  ) {
    return NextResponse.json(
      {
        error:
          "Giao dịch này đã có giá vốn nhập tay. Bật xác nhận ghi đè để gắn với tồn kho.",
        code: "CONFIRM_OVERWRITE_MANUAL_REQUIRED",
      },
      { status: 409 }
    );
  }

  const ctx: LinkContext = {
    sale: {
      id: sale.id,
      store_id: sale.store_id,
      quantity: Number(sale.quantity ?? 0),
      weight: sale.weight === null ? null : Number(sale.weight),
      total_amount: Number(sale.total_amount ?? 0),
      purchase_cost_amount:
        sale.purchase_cost_amount === null
          ? null
          : Number(sale.purchase_cost_amount),
      purchase_cost_source: sale.purchase_cost_source ?? null,
      product_category_id: sale.product_category_id,
    },
    inventory: {
      id: inventory.id,
      store_id: inventory.store_id,
      product_category_id: inventory.product_category_id,
      current_quantity:
        inventory.current_quantity === null
          ? null
          : Number(inventory.current_quantity),
      current_weight:
        inventory.current_weight === null
          ? null
          : Number(inventory.current_weight),
      initial_weight:
        inventory.initial_weight === null
          ? null
          : Number(inventory.initial_weight),
      purchase_unit_price:
        inventory.purchase_unit_price === null
          ? null
          : Number(inventory.purchase_unit_price),
      purchase_cost_amount:
        inventory.purchase_cost_amount === null
          ? null
          : Number(inventory.purchase_cost_amount),
      status: inventory.status,
      is_tax_cost_source: inventory.is_tax_cost_source,
    },
  };

  const { data: period } = await admin
    .from("tax_periods")
    .select("id, is_locked")
    .eq("store_id", auth.profile.store_id)
    .lte("start_date", sale.sale_date)
    .gte("end_date", sale.sale_date)
    .maybeSingle();

  if (period?.is_locked) {
    return NextResponse.json(
      { error: "Kỳ thuế đã khóa, không thể gắn lại giá vốn giao dịch này" },
      { status: 400 }
    );
  }

  let computation;
  try {
    computation = computeLink(ctx);
    if (sale.product_category_id) {
      const timeCost = await calculateTimeBasedInventoryCost(admin, {
        storeId: auth.profile.store_id,
        categoryId: sale.product_category_id,
        saleDate: sale.sale_date,
        saleWeight: sale.weight === null ? null : Number(sale.weight),
        saleWeightUnit: sale.weight_unit,
        saleQuantity: Number(sale.quantity ?? 0),
        excludeSaleId: sale.id,
      });
      computation = {
        ...computation,
        cost: timeCost.sale_cost,
        warnings: [
          ...computation.warnings,
          `Giá vốn tính theo ngày bán: ${timeCost.average_unit_cost.toLocaleString("vi-VN")} / chỉ`,
        ],
      };
    }
    await persistLink(admin, ctx, computation);
    if (sale.product_category_id) {
      await recordInventoryMovement(admin, {
        store_id: auth.profile.store_id,
        product_category_id: sale.product_category_id,
        inventory_item_id: inventory.id,
        source_type: "sale",
        source_id: sale.id,
        source_label: sale.id,
        movement_date: sale.sale_date,
        weight_delta: -Math.abs(
          Number(computation.weightDelta ?? computation.qtyDelta ?? 0)
        ),
        quantity_delta: -Math.abs(Number(computation.qtyDelta ?? 0)),
        cost_delta: -Math.abs(Number(computation.cost ?? 0)),
        unit_cost:
          computation.weightDelta && computation.weightDelta > 0
            ? computation.cost / computation.weightDelta
            : undefined,
        note: "Giảm tồn khi gắn giao dịch bán với tồn kho",
        created_by: auth.profile.id,
      });
    }
  } catch (e) {
    if (e instanceof InventoryLinkError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không gắn được tồn kho" },
      { status: 400 }
    );
  }

  // Recalculate the tax period this sale falls in, plus any later periods in the year.
  if (period?.id) {
    try {
      await recalculateTaxPeriod({
        storeId: auth.profile.store_id,
        periodId: period.id,
        calculatedBy: auth.profile.id,
      });
      await cascadeRecalculateYear({
        storeId: auth.profile.store_id,
        fromPeriodId: period.id,
        calculatedBy: auth.profile.id,
      });
    } catch {
      // Best-effort: surface link success even if recalc fails (admin can
      // re-trigger it from the tax-reports page).
    }
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "link_inventory_to_sale",
    entity_type: "sales_transactions",
    entity_id: sale.id,
    metadata: {
      inventory_item_id: inventory.id,
      cost: computation.cost,
      qty_delta: computation.qtyDelta,
      weight_delta: computation.weightDelta,
      new_inventory_status: computation.newStatus,
      warnings: computation.warnings,
    },
  });

  return NextResponse.json({
    cost: computation.cost,
    new_inventory_status: computation.newStatus,
    warnings: computation.warnings,
  });
}
