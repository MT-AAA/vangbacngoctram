import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
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
import { loadUnclassifiedReport } from "@/lib/reports/unclassified";
import { formatVND, formatNumber, formatVNDate } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function UnclassifiedReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const range = parseReportRange(searchParams);
  const [report, estimated] = await Promise.all([
    loadUnclassifiedReport(supabase, range),
    loadEstimatedSummary(supabase, { from: range.from, to: range.to }),
  ]);

  return (
    <ReportShell
      title="Sản phẩm chưa phân loại"
      description={`Liệt kê các dòng bán chưa gán nhóm sản phẩm trong ${range.label}.`}
      range={range}
      csvSlug="unclassified"
      hasEstimated={estimated.has_estimated}
      estimatedCount={estimated.estimated_count}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tổng quan</CardTitle>
          <CardDescription className="text-xs">
            Truy cập{" "}
            <Link href="/issues/unclassified" className="underline">
              Vấn đề · Chưa phân loại
            </Link>{" "}
            để gán nhóm hoặc tạo rule phân loại tự động.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày bán</TableHead>
                <TableHead>Hóa đơn</TableHead>
                <TableHead>Tên sản phẩm</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead>Trạng thái thuế</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">
                    {formatVNDate(r.sale_date)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.invoice_no ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.product_name_raw}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.quantity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.total_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.purchase_cost_amount !== null
                      ? formatVND(r.purchase_cost_amount)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.tax_calculation_status === "complete"
                          ? "success"
                          : r.tax_calculation_status === "estimated"
                          ? "secondary"
                          : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {r.tax_calculation_status ?? "—"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Tất cả dòng bán đều đã được phân loại trong khoảng đã chọn.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  Tổng ({report.totals.count} dòng,{" "}
                  {report.totals.missing_purchase_cost} thiếu giá vốn)
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.total_amount)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </ReportShell>
  );
}
