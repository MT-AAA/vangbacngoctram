import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/inventory/api";
import {
  ensureCostForTaxSource,
  inventoryCreateSchema,
} from "@/lib/inventory/schema";
import { categoryCodeToSkuCode } from "@/lib/inventory/sku";
import { recordInventoryMovement } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a new inventory item. Auto-generates the SKU when not provided
 * (uses the DB-side `next_inventory_sku` function for atomicity).
 *
 * RLS: admin + staff. Body validated by `inventoryCreateSchema`.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase);
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = inventoryCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Validate purchase cost when tax cost source.
  const costErr = ensureCostForTaxSource({
    is_tax_cost_source: input.is_tax_cost_source,
    purchase_cost_amount: input.purchase_cost_amount ?? null,
  });
  if (costErr) {
    return NextResponse.json({ error: costErr }, { status: 400 });
  }

  if (
    input.current_quantity !== null &&
    input.current_quantity !== undefined &&
    input.current_quantity < 0
  ) {
    return NextResponse.json(
      { error: "Số lượng hiện có không được âm" },
      { status: 400 }
    );
  }
  if (
    input.current_weight !== null &&
    input.current_weight !== undefined &&
    input.current_weight < 0
  ) {
    return NextResponse.json(
      { error: "Trọng lượng hiện có không được âm" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Resolve category code for SKU generation if needed.
  let sku = input.sku?.trim() ? input.sku.trim() : null;
  if (!sku) {
    const { data: cat } = await admin
      .from("product_categories")
      .select("code")
      .eq("id", input.category_id)
      .eq("store_id", auth.profile.store_id)
      .maybeSingle();
    if (!cat) {
      return NextResponse.json(
        { error: "Không tìm thấy phân loại sản phẩm" },
        { status: 400 }
      );
    }
    const code = categoryCodeToSkuCode(cat.code);
    const { data: skuValue, error: skuErr } = await admin.rpc(
      "next_inventory_sku",
      {
        p_store_id: auth.profile.store_id,
        p_category_code: code,
      }
    );
    if (skuErr || !skuValue) {
      return NextResponse.json(
        { error: skuErr?.message ?? "Không tạo được SKU" },
        { status: 500 }
      );
    }
    sku = skuValue as unknown as string;
  }

  const initialQty = input.initial_quantity ?? input.current_quantity ?? 0;
  const initialWeight = input.initial_weight ?? input.current_weight ?? null;
  const currentQty = input.current_quantity ?? initialQty;
  const currentWeight = input.current_weight ?? initialWeight;
  const weightUnit =
    input.weight_unit?.trim() || input.unit?.trim() || "chỉ";

  const { data: inserted, error: insertErr } = await admin
    .from("inventory_items")
    .insert({
      store_id: auth.profile.store_id,
      name: input.product_name,
      product_category_id: input.category_id,
      sku,
      product_type: input.product_type ?? null,
      purity: input.purity ?? null,
      unit: input.unit ?? null,
      weight_unit: weightUnit,
      initial_quantity: initialQty,
      current_quantity: currentQty,
      quantity_on_hand: currentQty,
      initial_weight: initialWeight,
      current_weight: currentWeight,
      weight: currentWeight,
      purchase_unit_price: input.purchase_unit_price ?? null,
      purchase_cost_amount: input.purchase_cost_amount ?? null,
      selling_price: input.selling_price ?? null,
      source_type: input.source_type ?? "manual",
      source_reference: input.source_reference ?? null,
      status: input.status ?? "in_stock",
      is_tax_cost_source: input.is_tax_cost_source ?? true,
      imported_at: input.imported_at ?? new Date().toISOString(),
      notes: input.note ?? null,
      attachment_url: input.attachment_url ?? null,
      created_by: auth.profile.id,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Không tạo được mặt hàng tồn kho" },
      { status: 500 }
    );
  }

  await recordInventoryMovement(admin, {
    store_id: auth.profile.store_id,
    product_category_id: input.category_id,
    inventory_item_id: inserted.id,
    source_type: input.source_type === "adjustment" ? "adjustment" : "manual",
    source_id: inserted.id,
    source_label: input.product_name,
    movement_date: input.imported_at ?? new Date().toISOString(),
    weight_delta: Number(currentWeight ?? 0),
    quantity_delta: Number(currentQty ?? 0),
    cost_delta: Number(input.purchase_cost_amount ?? 0),
    unit_cost: input.purchase_unit_price ?? null,
    note: input.note ?? null,
    created_by: auth.profile.id,
  });

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "create_inventory_item",
    entity_type: "inventory_items",
    entity_id: inserted.id,
    metadata: {
      sku: inserted.sku,
      name: inserted.name,
      source_type: inserted.source_type,
    },
  });

  return NextResponse.json({ item: inserted }, { status: 201 });
}
