import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/customer-purchases/api";
import { customerPurchaseUpdateSchema } from "@/lib/customer-purchases/schema";
import {
  ensureInventoryItemForPurchase,
  removeInventoryLink,
} from "@/lib/customer-purchases/inventory";

type CustomerPurchaseUpdate =
  Database["public"]["Tables"]["customer_purchases"]["Update"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/customer-purchases/[id] — partial update.
 *
 * Accepts the same body shape as POST but with all fields optional. The
 * inventory link is reconciled after the update so toggling
 * add_to_inventory creates / detaches the linked inventory_items row.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const auth = await requireMember(supabase);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = customerPurchaseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: before } = await admin
    .from("customer_purchases")
    .select("*")
    .eq("store_id", auth.profile.store_id)
    .eq("id", params.id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json(
      { error: "Không tìm thấy giao dịch" },
      { status: 404 }
    );
  }

  const updatePayload: CustomerPurchaseUpdate = {};
  if (input.purchase_date !== undefined)
    updatePayload.purchase_date = input.purchase_date;
  if (input.customer_name !== undefined)
    updatePayload.customer_name = input.customer_name;
  if (input.customer_phone !== undefined)
    updatePayload.customer_phone = input.customer_phone;
  if (input.customer_tax_code !== undefined)
    updatePayload.customer_tax_code = input.customer_tax_code;
  if (input.customer_id_card !== undefined)
    updatePayload.customer_id_card = input.customer_id_card;
  if (input.product_name !== undefined)
    updatePayload.product_name = input.product_name;
  if (input.product_category_id !== undefined)
    updatePayload.product_category_id = input.product_category_id;
  if (input.purity !== undefined) updatePayload.purity = input.purity;
  if (input.unit !== undefined) updatePayload.unit = input.unit;
  if (input.weight !== undefined) updatePayload.weight = input.weight;
  if (input.weight_unit !== undefined)
    updatePayload.weight_unit = input.weight_unit;
  if (input.quantity !== undefined) updatePayload.quantity = input.quantity;
  if (input.unit_buy_price !== undefined)
    updatePayload.unit_price = input.unit_buy_price;
  if (input.total_buy_amount !== undefined)
    updatePayload.total_amount = input.total_buy_amount;
  if (input.is_tax_purchase_input !== undefined)
    updatePayload.is_tax_purchase_input = input.is_tax_purchase_input;
  if (input.add_to_inventory !== undefined)
    updatePayload.becomes_inventory = input.add_to_inventory;
  if (input.notes !== undefined) updatePayload.notes = input.notes;
  if (input.image_url !== undefined) updatePayload.image_url = input.image_url;
  if (input.attachment_url !== undefined)
    updatePayload.attachment_url = input.attachment_url;

  const { data: after, error: updateErr } = await admin
    .from("customer_purchases")
    .update(updatePayload)
    .eq("store_id", auth.profile.store_id)
    .eq("id", params.id)
    .select("*")
    .single();

  if (updateErr || !after) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Không cập nhật được giao dịch" },
      { status: 500 }
    );
  }

  let inventoryItemId: string | null = after.inventory_item_id ?? null;
  if (after.becomes_inventory) {
    try {
      const link = await ensureInventoryItemForPurchase(admin, {
        store_id: auth.profile.store_id,
        purchase_id: after.id,
        product_name: after.product_name,
        product_category_id: after.product_category_id,
        quantity: Number(after.quantity ?? 0),
        weight:
          after.weight === null || after.weight === undefined
            ? null
            : Number(after.weight),
        weight_unit: after.weight_unit,
        unit_cost: Number(after.unit_price ?? 0),
        total_cost: Number(after.total_amount ?? 0),
        notes: after.notes ?? null,
        created_by: auth.profile.id,
      });
      inventoryItemId = link.inventory_item_id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi khi liên kết tồn kho";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } else if (before.inventory_item_id) {
    await removeInventoryLink(admin, after.id);
    inventoryItemId = null;
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "customer_purchase_update",
    entity_type: "customer_purchases",
    entity_id: after.id,
    diff: { before, after },
    metadata: {
      inventory_item_id: inventoryItemId,
    },
  });

  return NextResponse.json({ id: after.id, inventory_item_id: inventoryItemId });
}

/**
 * DELETE /api/customer-purchases/[id] — admin-only via RLS. The linked
 * inventory_items row (if any) is detached but not removed; the shop may
 * have additional notes / partial sales attached to it.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: before } = await admin
    .from("customer_purchases")
    .select("*")
    .eq("store_id", auth.profile.store_id)
    .eq("id", params.id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json(
      { error: "Không tìm thấy giao dịch" },
      { status: 404 }
    );
  }

  if (before.inventory_item_id) {
    await removeInventoryLink(admin, before.id);
  }

  const { error: deleteErr } = await admin
    .from("customer_purchases")
    .delete()
    .eq("store_id", auth.profile.store_id)
    .eq("id", params.id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "customer_purchase_delete",
    entity_type: "customer_purchases",
    entity_id: before.id,
    diff: { before },
  });

  return NextResponse.json({ ok: true });
}
