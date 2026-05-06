import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseIdsBody, requireMember, writeAuditLog } from "@/lib/issues/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mark missing-cost rows as intentionally ignored. The DB trigger flips
 * `tax_calculation_status` to `'ignored'` so dashboard counts stay
 * accurate.
 *
 * Body: { ids: string[], reason: string }
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
      { error: "Thiếu danh sách dòng cần đánh dấu" },
      { status: 400 }
    );
  }

  const reason = String(
    (body as { reason?: unknown }).reason ?? ""
  ).trim();
  if (!reason) {
    return NextResponse.json({ error: "Cần nhập lý do bỏ qua" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: updateErr, data: after } = await admin
    .from("sales_transactions")
    .update({
      is_intentionally_ignored: true,
      ignored_reason: reason,
      ignored_at: new Date().toISOString(),
      ignored_by: auth.profile.id,
    })
    .eq("store_id", auth.profile.store_id)
    .in("id", ids)
    .select("id, tax_calculation_status, ignored_reason, ignored_at");

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "issue_ignore_missing_cost",
    entity_type: "sales_transactions",
    entity_id: ids.length === 1 ? ids[0] : null,
    metadata: {
      ids,
      count: ids.length,
      reason,
    },
    diff: { after: after ?? [] },
  });

  return NextResponse.json({ updated: after?.length ?? 0 });
}
