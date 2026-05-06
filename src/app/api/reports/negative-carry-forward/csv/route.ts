import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadCarryForwardReport } from "@/lib/reports/vat-payable";
import { toCsv, csvHeaders } from "@/lib/reports/csv";

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const range = parseReportRange(sp);
  const report = await loadCarryForwardReport(supabase, range);

  const csv = toCsv(
    [
      ...report.rows.map((r) => ({
        period_name: r.period_name,
        start_date: r.start_date,
        end_date: r.end_date,
        value_added_amount: r.value_added_amount,
        negative_carried_in: r.negative_carried_in,
        consumed_in_period: r.consumed_in_period,
        taxable_value_added: r.taxable_value_added,
        vat_amount: r.vat_amount,
        negative_carried_out: r.negative_carried_out,
      })),
      {
        period_name: "Tổng",
        start_date: "",
        end_date: "",
        value_added_amount: "",
        negative_carried_in: report.totals.negative_carried_in,
        consumed_in_period: report.totals.consumed_in_period,
        taxable_value_added: "",
        vat_amount: report.totals.vat_amount,
        negative_carried_out: report.totals.negative_carried_out,
      },
    ],
    [
      { key: "period_name", header: "Kỳ" },
      { key: "start_date", header: "Bắt đầu" },
      { key: "end_date", header: "Kết thúc" },
      { key: "value_added_amount", header: "GTGT" },
      { key: "negative_carried_in", header: "Carry-in" },
      { key: "consumed_in_period", header: "Khấu trừ trong kỳ" },
      { key: "taxable_value_added", header: "GTGT chịu thuế" },
      { key: "vat_amount", header: "Thuế phải nộp" },
      { key: "negative_carried_out", header: "Carry-out" },
    ],
    {
      prefixLines: [
        `# Khoảng thời gian: ${range.label}`,
        "# Lưu ý: GTGT âm cuối năm tài chính KHÔNG chuyển sang năm sau.",
      ],
    }
  );

  return new NextResponse(csv, {
    headers: csvHeaders(
      `negative-carry-forward_${range.from}_${range.to}.csv`
    ),
  });
}
