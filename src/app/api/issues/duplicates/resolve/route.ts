import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/issues/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "merge" | "split";

function splitInvoiceNo(base: string | null, index: number) {
  if (!base) return null;
  if (index === 0) return base;
  return `${base}${String.fromCharCode(96 + index)}`;
}

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

  const rowIds = (body as { rowIds?: unknown }).rowIds;
  const mode = String((body as { mode?: unknown }).mode ?? "") as Mode;
  const note = String((body as { note?: unknown }).note ?? "").trim();

  if (!Array.isArray(rowIds) || rowIds.length < 2) {
    return NextResponse.json({ error: "Cần ít nhất 2 dòng để xử lý trùng" }, { status: 400 });
  }
  if (mode !== "merge" && mode !== "split") {
    return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
  }

  const ids = rowIds.filter((x): x is string => typeof x === "string" && x.length > 0);
  const admin = createAdminClient();

  const { data: before, error: beforeErr } = await admin
    .from("sales_transactions")
    .select("id, store_id, invoice_no, invoice_key, total_amount, duplicate_resolution_status")
    .in("id", ids)
    .eq("store_id", auth.profile.store_id);

  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 500 });
  if (!before || before.length !== ids.length) {
    return NextResponse.json({ error: "Không tìm thấy đủ dòng hóa đơn trùng" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const groupId = `dup_${now}_${ids[0]}`;
  const sorted = [...before].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const baseInvoiceNo = sorted[0]?.invoice_no ?? null;

  if (mode === "merge") {
    const keepId = sorted[0].id;
    const mergeIds = sorted.slice(1).map((r) => r.id);

    const { error: keepErr } = await admin
      .from("sales_transactions")
      .update({
        duplicate_resolution_status: "merge_keep",
        duplicate_resolution_group_id: groupId,
        duplicate_resolution_note: note || "Giữ lại dòng chính khi gộp hóa đơn",
        duplicate_resolved_at: now,
        duplicate_resolved_by: auth.profile.id,
      })
      .eq("id", keepId)
      .eq("store_id", auth.profile.store_id);
    if (keepErr) return NextResponse.json({ error: keepErr.message }, { status: 500 });

    const { error: mergeErr } = await admin
      .from("sales_transactions")
      .update({
        duplicate_resolution_status: "merged",
        duplicate_resolution_group_id: groupId,
        duplicate_resolution_note: note || "Đã gộp vào dòng chính",
        duplicate_resolved_at: now,
        duplicate_resolved_by: auth.profile.id,
        is_intentionally_ignored: true,
        ignored_at: now,
        ignored_by: auth.profile.id,
        ignored_reason: "Hóa đơn trùng đã gộp",
      })
      .in("id", mergeIds)
      .eq("store_id", auth.profile.store_id);
    if (mergeErr) return NextResponse.json({ error: mergeErr.message }, { status: 500 });

    const { error: movementErr } = await admin
      .from("inventory_movements")
      .delete()
      .eq("source_type", "sale")
      .in("source_id", mergeIds);
    if (movementErr) return NextResponse.json({ error: movementErr.message }, { status: 500 });
  } else {
    for (let i = 0; i < sorted.length; i += 1) {
      const row = sorted[i];
      const newInvoiceNo = splitInvoiceNo(baseInvoiceNo, i);
      const { error } = await admin
        .from("sales_transactions")
        .update({
          invoice_no: newInvoiceNo,
          duplicate_resolution_status: "split",
          duplicate_resolution_group_id: groupId,
          duplicate_resolution_note: note || `Tách hóa đơn thành ${newInvoiceNo ?? "—"}`,
          duplicate_resolved_at: now,
          duplicate_resolved_by: auth.profile.id,
        })
        .eq("id", row.id)
        .eq("store_id", auth.profile.store_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data: after } = await admin
    .from("sales_transactions")
    .select("id, invoice_no, duplicate_resolution_status, duplicate_resolution_group_id")
    .in("id", ids)
    .eq("store_id", auth.profile.store_id);

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: mode === "merge" ? "duplicate_invoice_merge" : "duplicate_invoice_split",
    entity_type: "sales_transactions",
    entity_id: ids[0],
    metadata: { ids, groupId, note },
    diff: { before, after },
  });

  return NextResponse.json({ ok: true, updated: ids.length, groupId });
}
