import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/inventory/api";
import { recordInventoryMovement } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openingBalanceSchema = z.object({
  effective_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Mốc thời gian không hợp lệ"),
  rows: z
    .array(
      z.object({
        category_id: z.string().uuid(),
        weight: z.number().finite().nonnegative(),
        cost: z.number().finite().nonnegative(),
      })
    )
    .min(1),
});

export async function GET() {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("inventory_movements")
    .select(
      "product_category_id, movement_date, weight_delta, cost_delta, unit_cost, source_id, source_label, category:product_categories(id, name, code)"
    )
    .eq("store_id", auth.profile.store_id)
    .eq("source_type", "opening_balance");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: (data ?? []).map((row) => ({
      category_id: row.product_category_id,
      category_name: Array.isArray(row.category)
        ? row.category[0]?.name
        : row.category?.name,
      category_code: Array.isArray(row.category)
        ? row.category[0]?.code
        : row.category?.code,
      effective_date: row.movement_date,
      weight: Number(row.weight_delta ?? 0),
      cost: Number(row.cost_delta ?? 0),
      unit_cost: Number(row.unit_cost ?? 0),
    })),
  });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = openingBalanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { effective_date, rows } = parsed.data;
  const saved: unknown[] = [];

  for (const row of rows) {
    const { data: category } = await admin
      .from("product_categories")
      .select("id, name, code")
      .eq("id", row.category_id)
      .eq("store_id", auth.profile.store_id)
      .maybeSingle();

    if (!category) {
      return NextResponse.json(
        { error: "Không tìm thấy nhóm hàng tồn kho" },
        { status: 400 }
      );
    }

    const sourceReference = `OPENING-BALANCE-${category.code}`;
    const unitCost = row.weight > 0 ? row.cost / row.weight : 0;

    const { data: existing } = await admin
      .from("inventory_items")
      .select("*")
      .eq("store_id", auth.profile.store_id)
      .eq("product_category_id", category.id)
      .eq("source_reference", sourceReference)
      .maybeSingle();

    const payload = {
      store_id: auth.profile.store_id,
      name: `Tồn đầu kỳ - ${category.name}`,
      product_category_id: category.id,
      product_type: "Tồn đầu kỳ",
      unit: "chỉ",
      weight_unit: "chỉ",
      initial_quantity: row.weight > 0 ? 1 : 0,
      current_quantity: row.weight > 0 ? 1 : 0,
      quantity_on_hand: row.weight > 0 ? 1 : 0,
      initial_weight: row.weight,
      current_weight: row.weight,
      weight: row.weight,
      purchase_unit_price: unitCost,
      purchase_cost_amount: row.cost,
      total_cost: row.cost,
      unit_cost: unitCost,
      source_type: "manual" as const,
      source_reference: sourceReference,
      status: "in_stock" as const,
      is_tax_cost_source: true,
      imported_at: `${effective_date}T00:00:00.000Z`,
      notes: `Khởi tạo tồn đầu kỳ tại mốc ${effective_date}`,
      created_by: auth.profile.id,
    };

    const result = existing
      ? await admin
          .from("inventory_items")
          .update(payload)
          .eq("id", existing.id)
          .eq("store_id", auth.profile.store_id)
          .select("*")
          .single()
      : await admin.from("inventory_items").insert(payload).select("*").single();

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error?.message ?? "Không lưu được tồn đầu kỳ" },
        { status: 500 }
      );
    }

    await recordInventoryMovement(admin, {
      store_id: auth.profile.store_id,
      product_category_id: category.id,
      inventory_item_id: result.data.id,
      source_type: "opening_balance",
      source_id: sourceReference,
      source_label: `Tồn đầu kỳ - ${category.name}`,
      movement_date: effective_date,
      weight_delta: row.weight,
      quantity_delta: row.weight > 0 ? 1 : 0,
      cost_delta: row.cost,
      unit_cost: unitCost,
      note: `Khởi tạo tồn đầu kỳ tại mốc ${effective_date}`,
      created_by: auth.profile.id,
    });

    saved.push(result.data);
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "upsert_inventory_opening_balance",
    entity_type: "inventory_items",
    metadata: { effective_date, rows },
  });

  return NextResponse.json({ ok: true, saved_count: saved.length });
}
