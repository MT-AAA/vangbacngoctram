import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadUnclassifiedReport } from "@/lib/reports/unclassified";
import { toCsv, csvHeaders } from "@/lib/reports/csv";

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const range = parseReportRange(sp);
  const report = await loadUnclassifiedReport(supabase, range);

  const csv = toCsv(
    [
      ...report.rows.map((r) => ({
        sale_date: r.sale_date,
        invoice_no: r.invoice_no ?? "",
        product_name_raw: r.product_name_raw,
        quantity: r.quantity,
        total_amount: r.total_amount,
        purchase_cost_amount: r.purchase_cost_amount ?? "",
        tax_calculation_status: r.tax_calculation_status ?? "",
      })),
      {
        sale_date: "Tổng",
        invoice_no: "",
        product_name_raw: `${report.totals.count} dòng (${report.totals.missing_purchase_cost} thiếu giá vốn)`,
        quantity: "",
        total_amount: report.totals.total_amount,
        purchase_cost_amount: "",
        tax_calculation_status: "",
      },
    ],
    [
      { key: "sale_date", header: "Ngày bán" },
      { key: "invoice_no", header: "Hóa đơn" },
      { key: "product_name_raw", header: "Tên sản phẩm" },
      { key: "quantity", header: "SL" },
      { key: "total_amount", header: "Doanh thu" },
      { key: "purchase_cost_amount", header: "Giá vốn" },
      { key: "tax_calculation_status", header: "Trạng thái thuế" },
    ],
    {
      prefixLines: [`# Khoảng thời gian: ${range.label}`],
    }
  );

  return new NextResponse(csv, {
    headers: csvHeaders(`unclassified_${range.from}_${range.to}.csv`),
  });
}
