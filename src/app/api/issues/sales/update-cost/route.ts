import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseIdsBody, requireMember, writeAuditLog } from "@/lib/issues/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bulk-set `purchase_cost_amount` (and `purchase_cost_source = 'manual'`) on
 * the selected sales_transactions. The DB trigger will recompute
 * value_added_amount and flip tax_calculation_status to 'complete'.
 *
 * Body: { ids: string[], purchase_cost_amount: number }
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

  const ids = parseIdsBody(body);
  if (!ids) {
    return NextResponse.json(
      { error: "Thiếu danh sách dòng cần cập nhật" },
      { status: 400 }
    );
  }

  const cost = (body as { purchase_cost_amount?: unknown }).purchase_cost_amount;
  const costNum = typeof cost === "number" ? cost : Number(cost);
  if (!Number.isFinite(costNum) || costNum <= 0) {
    return NextResponse.json(
      { error: "Giá vốn không hợp lệ" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Capture before-state for the audit diff.
  const { data: before } = await admin
    .from("sales_transactions")
    .select(
      "id, product_name_raw, total_amount, purchase_cost_amount, purchase_cost_source, tax_calculation_status, is_intentionally_ignored"
    )
    .eq("store_id", auth.profile.store_id)
    .in("id", ids);

  const eligibleIds = (before ?? [])
    .filter((r) => !r.is_intentionally_ignored)
    .map((r) => r.id);

  if (eligibleIds.length === 0) {
    return NextResponse.json(
      { error: "Không có dòng hợp lệ để cập nhật" },
      { status: 400 }
    );
  }

  const { error: updateErr, data: after } = await admin
    .from("sales_transactions")
    .update({
      purchase_cost_amount: costNum,
      purchase_cost_source: "manual",
    })
    .eq("store_id", auth.profile.store_id)
    .in("id", eligibleIds)
    .select(
      "id, purchase_cost_amount, purchase_cost_source, tax_calculation_status, value_added_amount"
    );

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "issue_update_cost",
    entity_type: "sales_transactions",
    entity_id: eligibleIds.length === 1 ? eligibleIds[0] : null,
    metadata: {
      ids: eligibleIds,
      count: eligibleIds.length,
      purchase_cost_amount: costNum,
    },
    diff: {
      before:
        (before ?? []).filter((r) => eligibleIds.includes(r.id)),
      after: after ?? [],
    },
  });

  return NextResponse.json({
    updated: eligibleIds.length,
    skipped: ids.length - eligibleIds.length,
  });
}
