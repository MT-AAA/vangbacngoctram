import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/inventory/api";
import {
  ensureCostForTaxSource,
  inventoryUpdateSchema,
} from "@/lib/inventory/schema";
import type { Database } from "@/lib/supabase/database.types";
import { recordInventoryMovement } from "@/lib/inventory/movements";
import { recalculateInventorySalesFromPurchase } from "@/lib/inventory/recalculate-sales";

type InventoryUpdate = Database["public"]["Tables"]["inventory_items"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Update an inventory item. Body validated by `inventoryUpdateSchema`
 * (every field optional). Refuses to overwrite a manually-entered cost
 * unless `confirm_overwrite_cost = true` is also set in the body.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const auth = await requireMember(supabase);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = inventoryUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const confirmOverwriteCost =
    typeof (raw as { confirm_overwrite_cost?: unknown })
      ?.confirm_overwrite_cost === "boolean"
      ? (raw as { confirm_overwrite_cost: boolean }).confirm_overwrite_cost
      : false;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("inventory_items")
    .select("*")
    .eq("id", params.id)
    .eq("store_id", auth.profile.store_id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }

  if (
    input.purchase_cost_amount !== undefined &&
    existing.purchase_cost_amount !== null &&
    Number(existing.purchase_cost_amount) !== Number(input.purchase_cost_amount) &&
    !confirmOverwriteCost
  ) {
    return NextResponse.json(
      {
        error:
          "Mặt hàng đã có giá mua thủ công. Bật xác nhận ghi đè để cập nhật.",
        code: "CONFIRM_OVERWRITE_COST_REQUIRED",
      },
      { status: 409 }
    );
  }

  if (
    input.current_quantity !== undefined &&
    input.current_quantity !== null &&
    input.current_quantity < 0
  ) {
    return NextResponse.json(
      { error: "Số lượng hiện có không được âm" },
      { status: 400 }
    );
  }
  if (
    input.current_weight !== undefined &&
    input.current_weight !== null &&
    input.current_weight < 0
  ) {
    return NextResponse.json(
      { error: "Trọng lượng hiện có không được âm" },
      { status: 400 }
    );
  }

  const merged = {
    is_tax_cost_source:
      input.is_tax_cost_source ?? existing.is_tax_cost_source,
    purchase_cost_amount:
      input.purchase_cost_amount === undefined
        ? existing.purchase_cost_amount
        : input.purchase_cost_amount,
  };
  const costErr = ensureCostForTaxSource(merged);
  if (costErr) {
    return NextResponse.json({ error: costErr }, { status: 400 });
  }

  const update: InventoryUpdate = {};
  if (input.product_name !== undefined) update.name = input.product_name;
  if (input.category_id !== undefined)
    update.product_category_id = input.category_id;
  if (input.sku !== undefined) update.sku = input.sku?.trim() || null;
  if (input.product_type !== undefined) update.product_type = input.product_type;
  if (input.purity !== undefined) update.purity = input.purity;
  if (input.unit !== undefined) update.unit = input.unit;
  if (input.weight_unit !== undefined && input.weight_unit)
    update.weight_unit = input.weight_unit;
  if (input.initial_quantity !== undefined)
    update.initial_quantity = input.initial_quantity;
  if (input.current_quantity !== undefined) {
    update.current_quantity = input.current_quantity;
    update.quantity_on_hand = input.current_quantity ?? 0;
  }
  if (input.initial_weight !== undefined)
    update.initial_weight = input.initial_weight;
  if (input.current_weight !== undefined) {
    update.current_weight = input.current_weight;
    update.weight = input.current_weight;
  }
  if (input.purchase_unit_price !== undefined)
    update.purchase_unit_price = input.purchase_unit_price;
  if (input.purchase_cost_amount !== undefined)
    update.purchase_cost_amount = input.purchase_cost_amount;
  if (input.selling_price !== undefined)
    update.selling_price = input.selling_price;
  if (input.source_type !== undefined) update.source_type = input.source_type;
  if (input.source_reference !== undefined)
    update.source_reference = input.source_reference;
  if (input.status !== undefined) update.status = input.status;
  if (input.is_tax_cost_source !== undefined)
    update.is_tax_cost_source = input.is_tax_cost_source;
  if (input.imported_at !== undefined) update.imported_at = input.imported_at;
  if (input.note !== undefined) update.notes = input.note;
  if (input.attachment_url !== undefined)
    update.attachment_url = input.attachment_url;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Không có trường nào để cập nhật" },
      { status: 400 }
    );
  }

  const { data: after, error: updateErr } = await admin
    .from("inventory_items")
    .update(update)
    .eq("id", params.id)
    .eq("store_id", auth.profile.store_id)
    .select("*")
    .single();

  if (updateErr || !after) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Không cập nhật được" },
      { status: 500 }
    );
  }

  const beforeCategoryId = existing.product_category_id;
  const afterCategoryId = after.product_category_id;
  const quantityDelta =
    Number(after.current_quantity ?? 0) - Number(existing.current_quantity ?? 0);
  const weightDelta =
    Number(after.current_weight ?? 0) - Number(existing.current_weight ?? 0);
  const costDelta =
    Number(after.purchase_cost_amount ?? 0) - Number(existing.purchase_cost_amount ?? 0);
  const inventoryChanged =
    beforeCategoryId !== afterCategoryId ||
    quantityDelta !== 0 ||
    weightDelta !== 0 ||
    costDelta !== 0 ||
    Number(after.purchase_unit_price ?? 0) !== Number(existing.purchase_unit_price ?? 0) ||
    after.imported_at !== existing.imported_at;

  let recalcResult: Awaited<ReturnType<typeof recalculateInventorySalesFromPurchase>> | null = null;
  if (inventoryChanged && afterCategoryId) {
    await recordInventoryMovement(admin, {
      store_id: auth.profile.store_id,
      product_category_id: afterCategoryId,
      inventory_item_id: after.id,
      source_type: "adjustment",
      source_id: `${after.id}:${Date.now()}`,
      source_label: after.name,
      movement_date: after.imported_at ?? new Date().toISOString(),
      weight_delta: weightDelta,
      quantity_delta: quantityDelta,
      cost_delta: costDelta,
      unit_cost:
        Number(after.current_weight ?? 0) > 0
          ? Number(after.purchase_cost_amount ?? 0) / Number(after.current_weight ?? 0)
          : Number(after.purchase_unit_price ?? 0) || undefined,
      note: "Điều chỉnh tồn kho thủ công",
      created_by: auth.profile.id,
    });

    const recalcFromDate = [existing.imported_at, after.imported_at]
      .filter(Boolean)
      .sort()[0] ?? new Date().toISOString();
    recalcResult = await recalculateInventorySalesFromPurchase(admin, {
      storeId: auth.profile.store_id,
      productCategoryId: afterCategoryId,
      purchaseDate: recalcFromDate,
      calculatedBy: auth.profile.id,
    });

    if (beforeCategoryId && beforeCategoryId !== afterCategoryId) {
      await recalculateInventorySalesFromPurchase(admin, {
        storeId: auth.profile.store_id,
        productCategoryId: beforeCategoryId,
        purchaseDate: recalcFromDate,
        calculatedBy: auth.profile.id,
      });
    }
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "update_inventory_item",
    entity_type: "inventory_items",
    entity_id: after.id,
    metadata: {
      sku: after.sku,
      name: after.name,
      confirm_overwrite_cost: confirmOverwriteCost,
      inventory_changed: inventoryChanged,
      recalc_result: recalcResult,
    },
    diff: { before: existing, after },
  });

  return NextResponse.json({ item: after });
}

/**
 * Permanently delete an inventory item that was created by mistake.
 * Only admins can delete, and linked sales are blocked to avoid breaking tax
 * calculations that already depend on this inventory item.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("inventory_items")
    .select("id, sku, name, store_id")
    .eq("id", params.id)
    .eq("store_id", auth.profile.store_id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }

  const { count: linkedSalesCount, error: linkedErr } = await admin
    .from("sales_transactions")
    .select("id", { count: "exact", head: true })
    .eq("linked_inventory_item_id", params.id);

  if (linkedErr) {
    return NextResponse.json({ error: linkedErr.message }, { status: 500 });
  }

  if ((linkedSalesCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Không thể xóa vì mặt hàng đã gắn với giao dịch bán. Hãy lưu trữ thay vì xóa.",
      },
      { status: 409 }
    );
  }

  const { error: deleteErr } = await admin
    .from("inventory_items")
    .delete()
    .eq("id", params.id)
    .eq("store_id", auth.profile.store_id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "delete_inventory_item",
    entity_type: "inventory_items",
    entity_id: existing.id,
    metadata: {
      sku: existing.sku,
      name: existing.name,
    },
  });

  return NextResponse.json({ ok: true });
}
