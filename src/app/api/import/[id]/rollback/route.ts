import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/issues/api";
import {
  cascadeRecalculateYear,
  recalculateTaxPeriod,
} from "@/lib/tax/recalculate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { id: string };
};

export async function POST(_request: Request, { params }: RouteContext) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  const importId = params.id;
  if (!importId) {
    return NextResponse.json({ error: "Thiếu mã lần nhập" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: importFile, error: importErr } = await admin
    .from("import_files")
    .select(
      "id, store_id, file_name, status, transaction_line_count, total_amount, period_start, period_end"
    )
    .eq("id", importId)
    .eq("store_id", auth.profile.store_id)
    .maybeSingle();

  if (importErr) {
    return NextResponse.json({ error: importErr.message }, { status: 500 });
  }
  if (!importFile) {
    return NextResponse.json(
      { error: "Không tìm thấy lần nhập" },
      { status: 404 }
    );
  }
  if (importFile.status === "rolled_back") {
    return NextResponse.json(
      { error: "Lần nhập này đã được xóa dữ liệu trước đó" },
      { status: 409 }
    );
  }
  if (importFile.status !== "completed") {
    return NextResponse.json(
      { error: "Chỉ có thể xóa dữ liệu của lần nhập đã hoàn tất" },
      { status: 409 }
    );
  }

  const { data: salesRows, error: salesErr } = await admin
    .from("sales_transactions")
    .select("id, sale_date, total_amount")
    .eq("store_id", auth.profile.store_id)
    .eq("import_file_id", importId);

  if (salesErr) {
    return NextResponse.json({ error: salesErr.message }, { status: 500 });
  }

  const saleDates = Array.from(
    new Set((salesRows ?? []).map((row) => row.sale_date).filter(Boolean))
  );

  const periodIds = new Set<string>();
  if (saleDates.length > 0) {
    const { data: periods, error: periodsErr } = await admin
      .from("tax_periods")
      .select("id, start_date, end_date")
      .eq("store_id", auth.profile.store_id);

    if (periodsErr) {
      return NextResponse.json({ error: periodsErr.message }, { status: 500 });
    }

    for (const date of saleDates) {
      const matched = (periods ?? []).find(
        (period) => period.start_date <= date && period.end_date >= date
      );
      if (matched) periodIds.add(matched.id);
    }
  }

  const deletedCount = salesRows?.length ?? 0;
  const deletedAmount = (salesRows ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount ?? 0),
    0
  );

  const { error: deleteErr } = await admin
    .from("sales_transactions")
    .delete()
    .eq("store_id", auth.profile.store_id)
    .eq("import_file_id", importId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("import_files")
    .update({
      status: "rolled_back",
      notes: `Đã xóa dữ liệu nhập lúc ${now}`,
      processed_at: now,
    })
    .eq("id", importId)
    .eq("store_id", auth.profile.store_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const recalculatedPeriodIds: string[] = [];
  for (const periodId of Array.from(periodIds)) {
    try {
      await recalculateTaxPeriod({
        storeId: auth.profile.store_id,
        periodId,
        calculatedBy: auth.profile.id,
      });
      await cascadeRecalculateYear({
        storeId: auth.profile.store_id,
        fromPeriodId: periodId,
        calculatedBy: auth.profile.id,
      });
      recalculatedPeriodIds.push(periodId);
    } catch {
      // Best-effort. Admin can recalculate manually from the tax report page.
    }
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "rollback_import",
    entity_type: "import_files",
    entity_id: importId,
    metadata: {
      file_name: importFile.file_name,
      deleted_sales_rows: deletedCount,
      deleted_total_amount: deletedAmount,
      original_transaction_line_count: importFile.transaction_line_count,
      original_total_amount: importFile.total_amount,
      period_start: importFile.period_start,
      period_end: importFile.period_end,
      recalculated_period_ids: recalculatedPeriodIds,
    },
  });

  return NextResponse.json({
    import_file_id: importId,
    deleted_sales_rows: deletedCount,
    deleted_total_amount: deletedAmount,
    recalculated_period_count: recalculatedPeriodIds.length,
  });
}
