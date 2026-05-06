import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReportShell } from "@/components/reports/report-shell";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadEstimatedSummary } from "@/lib/reports/has-estimated";
import { loadVatPayableReport } from "@/lib/reports/vat-payable";
import { formatVND, formatNumber, formatVNDate } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

const PERIOD_TYPE_LABELS: Record<string, string> = {
  month: "Tháng",
  quarter: "Quý",
  year: "Năm",
  custom: "Tùy chỉnh",
};

export default async function VatPayableReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const range = parseReportRange(searchParams);
  const [report, estimated] = await Promise.all([
    loadVatPayableReport(supabase, range),
    loadEstimatedSummary(supabase, { from: range.from, to: range.to }),
  ]);

  return (
    <ReportShell
      title="Thuế GTGT phải nộp theo kỳ"
      description={`Báo cáo thuế GTGT trực tiếp trong ${range.label}. Số phải nộp = GTGT chịu thuế × thuế suất.`}
      range={range}
      csvSlug="vat-payable"
      hasEstimated={estimated.has_estimated}
      estimatedCount={estimated.estimated_count}
      badge={
        <Badge variant="secondary" className="text-[10px]">
          Phương pháp trực tiếp
        </Badge>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{range.label}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kỳ</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Khoảng</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">GTGT</TableHead>
                <TableHead className="text-right">Carry-in</TableHead>
                <TableHead className="text-right">GTGT chịu thuế</TableHead>
                <TableHead className="text-right">VAT %</TableHead>
                <TableHead className="text-right">Thuế phải nộp</TableHead>
                <TableHead className="text-right">Carry-out</TableHead>
                <TableHead className="text-right">Ước tính</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.period_id}>
                  <TableCell className="font-medium">
                    {r.period_name}
                    {r.is_locked ? (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Đã khoá
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {PERIOD_TYPE_LABELS[r.period_type] ?? r.period_type}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatVNDate(r.start_date)} → {formatVNDate(r.end_date)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.total_sales_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.total_purchase_cost_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.value_added_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.negative_carried_in > 0
                      ? formatVND(r.negative_carried_in)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.taxable_value_added)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.vat_rate, 2)}%
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatVND(r.vat_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.negative_carried_out > 0
                      ? formatVND(r.negative_carried_out)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-amber-700">
                    {r.transactions_estimated > 0
                      ? formatNumber(r.transactions_estimated, 0)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Chưa có kỳ tính thuế nào trong khoảng đã chọn.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  Tổng
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.total_sales_amount)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.total_purchase_cost_amount)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.value_added_amount)}
                </TableCell>
                <TableCell className="text-right" />
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.taxable_value_added)}
                </TableCell>
                <TableCell className="text-right" />
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.vat_amount)}
                </TableCell>
                <TableCell className="text-right" />
                <TableCell className="text-right font-semibold text-amber-700">
                  {report.totals.transactions_estimated > 0
                    ? formatNumber(report.totals.transactions_estimated, 0)
                    : "—"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Báo cáo dùng phương pháp trực tiếp:{" "}
        <strong>Số phải nộp = GTGT chịu thuế × thuế suất</strong>. Phần GTGT
        âm chuyển sang kỳ sau (cùng năm dương lịch). Báo cáo KHÔNG sử dụng
        thuế đầu ra trên hoá đơn (vat_output_amount) làm số phải nộp.
      </p>
    </ReportShell>
  );
}
