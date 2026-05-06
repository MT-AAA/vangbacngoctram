import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseIdsBody, requireMember, writeAuditLog } from "@/lib/issues/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Revert "ignored" flag. Trigger sees the row goes back to having no
 * purchase_cost and re-flags it as missing_purchase_cost.
 *
 * Body: { ids: string[] }
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
      { error: "Thiếu danh sách dòng" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { error: updateErr, data: after } = await admin
    .from("sales_transactions")
    .update({
      is_intentionally_ignored: false,
      ignored_reason: null,
      ignored_at: null,
      ignored_by: null,
    })
    .eq("store_id", auth.profile.store_id)
    .in("id", ids)
    .select("id, tax_calculation_status");

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "issue_unignore_missing_cost",
    entity_type: "sales_transactions",
    entity_id: ids.length === 1 ? ids[0] : null,
    metadata: { ids, count: ids.length },
    diff: { after: after ?? [] },
  });

  return NextResponse.json({ updated: after?.length ?? 0 });
}
