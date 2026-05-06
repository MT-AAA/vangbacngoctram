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
import { loadSalesByCategory } from "@/lib/reports/sales-by-category";
import { formatVND, formatNumber } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SalesByCategoryReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const range = parseReportRange(searchParams);
  const [report, estimated] = await Promise.all([
    loadSalesByCategory(supabase, range),
    loadEstimatedSummary(supabase, { from: range.from, to: range.to }),
  ]);

  return (
    <ReportShell
      title="Doanh thu theo nhóm sản phẩm"
      description={`Cơ cấu doanh thu / giá vốn / GTGT theo nhóm sản phẩm trong ${range.label}.`}
      range={range}
      csvSlug="sales-by-category"
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
                <TableHead>Nhóm</TableHead>
                <TableHead className="text-right">Số GD</TableHead>
                <TableHead className="text-right">Tổng SL</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">GTGT</TableHead>
                <TableHead className="text-right">Tỷ trọng</TableHead>
                <TableHead className="text-right">Ước tính</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.category_id ?? "__none__"}>
                  <TableCell className="font-medium">
                    {r.category_name}
                    {r.category_id === null ? (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Chưa phân loại
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.transaction_count, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.total_quantity)}
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
                    {formatNumber(r.share_pct, 2)}%
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
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Không có dữ liệu trong khoảng đã chọn.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Tổng</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatNumber(report.totals.transaction_count, 0)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatNumber(report.totals.total_quantity)}
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
                <TableCell className="text-right font-semibold">100%</TableCell>
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
