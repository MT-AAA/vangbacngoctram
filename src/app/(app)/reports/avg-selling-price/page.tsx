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
import { loadAvgSellingPrice } from "@/lib/reports/avg-selling-price";
import { loadCategoryOptions } from "@/lib/reports/categories";
import { formatVND, formatNumber } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function getCategory(searchParams: SearchParams): string | null {
  const v = searchParams["category"];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function AvgSellingPriceReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const range = parseReportRange(searchParams);
  const category = getCategory(searchParams);
  const [report, estimated, categoryOptions] = await Promise.all([
    loadAvgSellingPrice(supabase, range, { categoryId: category }),
    loadEstimatedSummary(supabase, { from: range.from, to: range.to }),
    loadCategoryOptions(supabase),
  ]);

  return (
    <ReportShell
      title="Giá bán bình quân theo nhóm và trọng lượng"
      description={`Đơn giá bình quân và đồng/chỉ bình quân của từng nhóm trong ${range.label}.`}
      range={range}
      showCategoryFilter
      categoryOptions={categoryOptions.map((c) => ({ id: c.id, name: c.name }))}
      category={category ?? undefined}
      csvSlug="avg-selling-price"
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
                <TableHead className="text-right">Trọng lượng (chỉ)</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Đơn giá BQ</TableHead>
                <TableHead className="text-right">Đồng/chỉ BQ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.category_id ?? "__none__"}>
                  <TableCell className="font-medium">
                    {r.category_name}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.transaction_count, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.total_quantity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.total_weight_chi > 0
                      ? formatNumber(r.total_weight_chi)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.total_sales_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.avg_unit_price !== null ? formatVND(r.avg_unit_price) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.avg_price_per_chi !== null
                      ? formatVND(r.avg_price_per_chi)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Không có dữ liệu.
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
                  {report.totals.total_weight_chi > 0
                    ? formatNumber(report.totals.total_weight_chi)
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.total_sales_amount)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {report.totals.avg_unit_price !== null
                    ? formatVND(report.totals.avg_unit_price)
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {report.totals.avg_price_per_chi !== null
                    ? formatVND(report.totals.avg_price_per_chi)
                    : "—"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Quy ước trọng lượng: 1 chỉ ≈ 3.75g, 1 lượng = 10 chỉ. Báo cáo quy đổi
        các đơn vị (gram, kg, lượng) về &quot;chỉ&quot; để tính giá bình quân
        theo trọng lượng.
      </p>
    </ReportShell>
  );
}
