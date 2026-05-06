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
import { ReportShell } from "@/components/reports/report-shell";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadEstimatedSummary } from "@/lib/reports/has-estimated";
import { loadCarryForwardReport } from "@/lib/reports/vat-payable";
import { formatVND, formatVNDate } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NegativeCarryForwardReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const range = parseReportRange(searchParams);
  const [report, estimated] = await Promise.all([
    loadCarryForwardReport(supabase, range),
    loadEstimatedSummary(supabase, { from: range.from, to: range.to }),
  ]);

  return (
    <ReportShell
      title="GTGT âm chuyển kỳ sau"
      description={`Theo dõi GTGT âm carry-in / carry-out của từng kỳ trong ${range.label}.`}
      range={range}
      csvSlug="negative-carry-forward"
      hasEstimated={estimated.has_estimated}
      estimatedCount={estimated.estimated_count}
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
                <TableHead>Khoảng</TableHead>
                <TableHead className="text-right">GTGT</TableHead>
                <TableHead className="text-right">Carry-in</TableHead>
                <TableHead className="text-right">Khấu trừ trong kỳ</TableHead>
                <TableHead className="text-right">GTGT chịu thuế</TableHead>
                <TableHead className="text-right">Thuế phải nộp</TableHead>
                <TableHead className="text-right">Carry-out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.period_id}>
                  <TableCell className="font-medium">{r.period_name}</TableCell>
                  <TableCell className="text-xs">
                    {formatVNDate(r.start_date)} → {formatVNDate(r.end_date)}
                  </TableCell>
                  <TableCell
                    className={
                      "text-right " +
                      (r.value_added_amount < 0 ? "text-rose-700" : "")
                    }
                  >
                    {formatVND(r.value_added_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.negative_carried_in > 0
                      ? formatVND(r.negative_carried_in)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-emerald-700">
                    {r.consumed_in_period > 0
                      ? formatVND(r.consumed_in_period)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.taxable_value_added)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatVND(r.vat_amount)}
                  </TableCell>
                  <TableCell className="text-right text-rose-700">
                    {r.negative_carried_out > 0
                      ? formatVND(r.negative_carried_out)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Không có kỳ nào có GTGT âm chuyển kỳ trong khoảng đã chọn.
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
                  {formatVND(report.totals.negative_carried_in)}
                </TableCell>
                <TableCell className="text-right font-semibold text-emerald-700">
                  {formatVND(report.totals.consumed_in_period)}
                </TableCell>
                <TableCell className="text-right" />
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.vat_amount)}
                </TableCell>
                <TableCell className="text-right font-semibold text-rose-700">
                  {formatVND(report.totals.negative_carried_out)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        GTGT âm còn lại cuối <strong>năm tài chính</strong> KHÔNG được chuyển
        sang năm kế tiếp; phần này sẽ bị xoá khi sang năm mới.
      </p>
    </ReportShell>
  );
}
