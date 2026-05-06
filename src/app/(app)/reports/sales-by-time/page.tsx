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
import { loadSalesByTime } from "@/lib/reports/sales-by-time";
import { formatVND, formatNumber } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SalesByTimeReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const range = parseReportRange(searchParams);
  const [report, estimated] = await Promise.all([
    loadSalesByTime(supabase, range),
    loadEstimatedSummary(supabase, { from: range.from, to: range.to }),
  ]);

  return (
    <ReportShell
      title="Doanh thu theo thời gian"
      description={`Tổng doanh thu, giá vốn và GTGT theo bucket ${range.bucketKind} trong ${range.label}.`}
      range={range}
      csvSlug="sales-by-time"
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
                <TableHead>Bucket</TableHead>
                <TableHead className="text-right">Số GD</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">GTGT</TableHead>
                <TableHead className="text-right">Ước tính</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.buckets.map((b) => (
                <TableRow key={`${b.start}-${b.end}-${b.label}`}>
                  <TableCell className="font-medium">{b.label}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(b.transaction_count, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(b.total_sales_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(b.total_purchase_cost_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(b.value_added_amount)}
                  </TableCell>
                  <TableCell className="text-right text-amber-700">
                    {b.transactions_estimated > 0
                      ? formatNumber(b.transactions_estimated, 0)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Tổng</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatNumber(report.totals.transaction_count, 0)}
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
    </ReportShell>
  );
}
