import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadSalesByTime } from "@/lib/reports/sales-by-time";
import { toCsv, csvHeaders } from "@/lib/reports/csv";

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const range = parseReportRange(sp);
  const report = await loadSalesByTime(supabase, range);

  const prefix: string[] = [];
  if (report.totals.transactions_estimated > 0) {
    prefix.push(
      `# Báo cáo có ${report.totals.transactions_estimated} dòng dùng giá vốn ước tính (purchase_cost_source = 'average').`
    );
  }
  prefix.push(`# Khoảng thời gian: ${range.label} (${range.from} → ${range.to})`);

  const csv = toCsv(
    [
      ...report.buckets.map((b) => ({
        bucket: b.label,
        from: b.start,
        to: b.end,
        transaction_count: b.transaction_count,
        total_sales_amount: b.total_sales_amount,
        total_purchase_cost_amount: b.total_purchase_cost_amount,
        value_added_amount: b.value_added_amount,
        transactions_estimated: b.transactions_estimated,
      })),
      {
        bucket: "Tổng",
        from: range.from,
        to: range.to,
        transaction_count: report.totals.transaction_count,
        total_sales_amount: report.totals.total_sales_amount,
        total_purchase_cost_amount: report.totals.total_purchase_cost_amount,
        value_added_amount: report.totals.value_added_amount,
        transactions_estimated: report.totals.transactions_estimated,
      },
    ],
    [
      { key: "bucket", header: "Bucket" },
      { key: "from", header: "Từ ngày" },
      { key: "to", header: "Đến ngày" },
      { key: "transaction_count", header: "Số GD" },
      { key: "total_sales_amount", header: "Doanh thu" },
      { key: "total_purchase_cost_amount", header: "Giá vốn" },
      { key: "value_added_amount", header: "GTGT" },
      { key: "transactions_estimated", header: "Số GD ước tính" },
    ],
    { prefixLines: prefix }
  );

  return new NextResponse(csv, {
    headers: csvHeaders(`sales-by-time_${range.from}_${range.to}.csv`),
  });
}
