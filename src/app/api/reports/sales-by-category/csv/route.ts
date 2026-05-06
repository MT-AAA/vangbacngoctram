import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadSalesByCategory } from "@/lib/reports/sales-by-category";
import { toCsv, csvHeaders } from "@/lib/reports/csv";

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const range = parseReportRange(sp);
  const report = await loadSalesByCategory(supabase, range);

  const prefix: string[] = [];
  if (report.totals.transactions_estimated > 0) {
    prefix.push(
      `# Báo cáo có ${report.totals.transactions_estimated} dòng dùng giá vốn ước tính (purchase_cost_source = 'average').`
    );
  }
  prefix.push(`# Khoảng thời gian: ${range.label} (${range.from} → ${range.to})`);

  const csv = toCsv(
    [
      ...report.rows.map((r) => ({
        category_name: r.category_name,
        transaction_count: r.transaction_count,
        total_quantity: r.total_quantity,
        total_sales_amount: r.total_sales_amount,
        total_purchase_cost_amount: r.total_purchase_cost_amount,
        value_added_amount: r.value_added_amount,
        share_pct: r.share_pct,
        transactions_estimated: r.transactions_estimated,
      })),
      {
        category_name: "Tổng",
        transaction_count: report.totals.transaction_count,
        total_quantity: report.totals.total_quantity,
        total_sales_amount: report.totals.total_sales_amount,
        total_purchase_cost_amount: report.totals.total_purchase_cost_amount,
        value_added_amount: report.totals.value_added_amount,
        share_pct: 100,
        transactions_estimated: report.totals.transactions_estimated,
      },
    ],
    [
      { key: "category_name", header: "Nhóm" },
      { key: "transaction_count", header: "Số GD" },
      { key: "total_quantity", header: "Tổng SL" },
      { key: "total_sales_amount", header: "Doanh thu" },
      { key: "total_purchase_cost_amount", header: "Giá vốn" },
      { key: "value_added_amount", header: "GTGT" },
      { key: "share_pct", header: "Tỷ trọng %" },
      { key: "transactions_estimated", header: "Số GD ước tính" },
    ],
    { prefixLines: prefix }
  );

  return new NextResponse(csv, {
    headers: csvHeaders(`sales-by-category_${range.from}_${range.to}.csv`),
  });
}
