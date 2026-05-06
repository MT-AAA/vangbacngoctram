import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadVatPayableReport } from "@/lib/reports/vat-payable";
import { toCsv, csvHeaders } from "@/lib/reports/csv";

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const range = parseReportRange(sp);
  const report = await loadVatPayableReport(supabase, range);

  const prefix: string[] = [];
  if (report.totals.transactions_estimated > 0) {
    prefix.push(
      `# Báo cáo có ${report.totals.transactions_estimated} dòng dùng giá vốn ước tính.`
    );
  }
  prefix.push(`# Khoảng thời gian: ${range.label}`);
  prefix.push(
    "# Phương pháp trực tiếp: Số phải nộp = GTGT chịu thuế × thuế suất; KHÔNG dùng thuế đầu ra hoá đơn."
  );

  const csv = toCsv(
    [
      ...report.rows.map((r) => ({
        period_name: r.period_name,
        period_type: r.period_type,
        start_date: r.start_date,
        end_date: r.end_date,
        total_sales_amount: r.total_sales_amount,
        total_purchase_cost_amount: r.total_purchase_cost_amount,
        value_added_amount: r.value_added_amount,
        negative_carried_in: r.negative_carried_in,
        taxable_value_added: r.taxable_value_added,
        vat_rate: r.vat_rate,
        vat_amount: r.vat_amount,
        negative_carried_out: r.negative_carried_out,
        transactions_estimated: r.transactions_estimated,
        is_locked: r.is_locked ? "1" : "0",
      })),
      {
        period_name: "Tổng",
        period_type: "",
        start_date: "",
        end_date: "",
        total_sales_amount: report.totals.total_sales_amount,
        total_purchase_cost_amount: report.totals.total_purchase_cost_amount,
        value_added_amount: report.totals.value_added_amount,
        negative_carried_in: "",
        taxable_value_added: report.totals.taxable_value_added,
        vat_rate: "",
        vat_amount: report.totals.vat_amount,
        negative_carried_out: "",
        transactions_estimated: report.totals.transactions_estimated,
        is_locked: "",
      },
    ],
    [
      { key: "period_name", header: "Kỳ" },
      { key: "period_type", header: "Loại" },
      { key: "start_date", header: "Bắt đầu" },
      { key: "end_date", header: "Kết thúc" },
      { key: "total_sales_amount", header: "Doanh thu" },
      { key: "total_purchase_cost_amount", header: "Giá vốn" },
      { key: "value_added_amount", header: "GTGT" },
      { key: "negative_carried_in", header: "Carry-in" },
      { key: "taxable_value_added", header: "GTGT chịu thuế" },
      { key: "vat_rate", header: "Thuế suất %" },
      { key: "vat_amount", header: "Thuế phải nộp" },
      { key: "negative_carried_out", header: "Carry-out" },
      { key: "transactions_estimated", header: "Số GD ước tính" },
      { key: "is_locked", header: "Đã khoá" },
    ],
    { prefixLines: prefix }
  );

  return new NextResponse(csv, {
    headers: csvHeaders(`vat-payable_${range.from}_${range.to}.csv`),
  });
}
