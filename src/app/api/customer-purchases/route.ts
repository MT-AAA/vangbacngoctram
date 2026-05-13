import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/customer-purchases/api";
import { customerPurchaseCreateSchema } from "@/lib/customer-purchases/schema";
import { ensureInventoryItemForPurchase } from "@/lib/customer-purchases/inventory";
import { getPurchaseRecalcImpact } from "@/lib/customer-purchases/recalc-impact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/customer-purchases — record a new manual customer purchase.
 *
 * Body matches `customerPurchaseCreateSchema`. When `add_to_inventory` is
 * true, a linked inventory_items row is created and bidirectionally
 * referenced. Every successful insert emits an `audit_logs` row.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = customerPurchaseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dữ liệu không hợp lệ",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const insertPayload = {
    store_id: auth.profile.store_id,
    purchase_date: input.purchase_date,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    customer_tax_code: input.customer_tax_code,
    customer_id_card: input.customer_id_card,
    product_name: input.product_name,
    product_category_id: input.product_category_id,
    purity: input.purity,
    unit: input.unit,
    weight: input.weight,
    weight_unit: input.weight_unit,
    quantity: input.quantity,
    unit_price: input.unit_buy_price,
    total_amount: input.total_buy_amount,
    is_tax_purchase_input: input.is_tax_purchase_input,
    becomes_inventory: input.add_to_inventory,
    notes: input.notes,
    image_url: input.image_url,
    attachment_url: input.attachment_url,
    created_by: auth.profile.id,
  };

  const { data: inserted, error: insertErr } = await admin
    .from("customer_purchases")
    .insert(insertPayload)
    .select("*")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Không lưu được giao dịch" },
      { status: 500 }
    );
  }

  let inventoryItemId: string | null = null;
  if (input.add_to_inventory) {
    try {
      const link = await ensureInventoryItemForPurchase(admin, {
        store_id: auth.profile.store_id,
        purchase_id: inserted.id,
        product_name: input.product_name,
        product_category_id: input.product_category_id,
        quantity: input.quantity,
        weight: input.weight,
        weight_unit: input.weight_unit,
        unit_cost: input.unit_buy_price,
        total_cost: input.total_buy_amount,
        notes: input.notes,
        created_by: auth.profile.id,
        purchase_date: input.purchase_date,
      });
      inventoryItemId = link.inventory_item_id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi khi liên kết tồn kho";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const recalcImpact = input.add_to_inventory
    ? await getPurchaseRecalcImpact(admin, {
        storeId: auth.profile.store_id,
        productCategoryId: input.product_category_id,
        purchaseDate: input.purchase_date,
      })
    : { affected_sales_count: 0, locked_period_count: 0, earliest_sale_date: null };

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "customer_purchase_create",
    entity_type: "customer_purchases",
    entity_id: inserted.id,
    diff: { after: inserted },
    metadata: {
      inventory_item_id: inventoryItemId,
      add_to_inventory: input.add_to_inventory,
      is_tax_purchase_input: input.is_tax_purchase_input,
      recalc_impact: recalcImpact,
    },
  });

  return NextResponse.json({
    id: inserted.id,
    inventory_item_id: inventoryItemId,
    recalc_impact: recalcImpact,
  });
}
