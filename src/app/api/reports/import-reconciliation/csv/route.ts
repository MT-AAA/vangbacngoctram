import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadImportReconReport } from "@/lib/reports/import-reconciliation";
import { toCsv, csvHeaders } from "@/lib/reports/csv";

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const range = parseReportRange(sp);
  const report = await loadImportReconReport(supabase, {
    from: range.from,
    to: range.to,
  });

  const csv = toCsv(
    [
      ...report.rows.map((r) => ({
        created_at: r.created_at,
        file_name: r.file_name,
        status: r.status,
        period_start: r.period_start ?? "",
        period_end: r.period_end ?? "",
        expected_count: r.expected_count,
        imported_count: r.imported_count,
        delta_count: r.delta_count,
        expected_amount: r.expected_amount,
        imported_amount: r.imported_amount,
        delta_amount: r.delta_amount,
        inserted_rows: r.inserted_rows,
        updated_rows: r.updated_rows,
        error_rows: r.error_rows,
      })),
      {
        created_at: "Tổng",
        file_name: `${report.totals.files} file`,
        status: "",
        period_start: "",
        period_end: "",
        expected_count: report.totals.expected_count,
        imported_count: report.totals.imported_count,
        delta_count: report.totals.delta_count,
        expected_amount: report.totals.expected_amount,
        imported_amount: report.totals.imported_amount,
        delta_amount: report.totals.delta_amount,
        inserted_rows: "",
        updated_rows: "",
        error_rows: "",
      },
    ],
    [
      { key: "created_at", header: "Ngày upload" },
      { key: "file_name", header: "Tên file" },
      { key: "status", header: "Trạng thái" },
      { key: "period_start", header: "Kỳ từ" },
      { key: "period_end", header: "Kỳ đến" },
      { key: "expected_count", header: "Expected SL" },
      { key: "imported_count", header: "Imported SL" },
      { key: "delta_count", header: "Δ SL" },
      { key: "expected_amount", header: "Expected tiền" },
      { key: "imported_amount", header: "Imported tiền" },
      { key: "delta_amount", header: "Δ tiền" },
      { key: "inserted_rows", header: "Mới" },
      { key: "updated_rows", header: "Cập nhật" },
      { key: "error_rows", header: "Lỗi" },
    ],
    { prefixLines: [`# Khoảng thời gian: ${range.label}`] }
  );

  return new NextResponse(csv, {
    headers: csvHeaders(
      `import-reconciliation_${range.from}_${range.to}.csv`
    ),
  });
}
