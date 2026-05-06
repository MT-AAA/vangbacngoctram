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
import { ReportShell } from "@/components/reports/report-shell";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadCategoryOptions } from "@/lib/reports/categories";
import { loadInventoryReport } from "@/lib/reports/inventory";
import { formatVND, formatNumber, formatVNDate } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function getCategory(searchParams: SearchParams): string | null {
  const v = searchParams["category"];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const range = parseReportRange(searchParams);
  const category = getCategory(searchParams);
  const [report, categoryOptions] = await Promise.all([
    loadInventoryReport(supabase, { categoryId: category }),
    loadCategoryOptions(supabase),
  ]);

  return (
    <ReportShell
      title="Tồn kho"
      description="Liệt kê các mặt hàng đang ở trạng thái in_stock. Trọng lượng được quy đổi ra chỉ."
      range={range}
      showCategoryFilter
      categoryOptions={categoryOptions.map((c) => ({ id: c.id, name: c.name }))}
      category={category ?? undefined}
      csvSlug="inventory"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tổng theo nhóm</CardTitle>
          <CardDescription className="text-xs">
            Snapshot ngay lúc xem báo cáo (không lọc theo khoảng thời gian).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhóm</TableHead>
                <TableHead className="text-right">Số mặt hàng</TableHead>
                <TableHead className="text-right">SL tồn</TableHead>
                <TableHead className="text-right">Trọng lượng (chỉ)</TableHead>
                <TableHead className="text-right">Giá trị tồn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byCategory.map((c) => (
                <TableRow key={c.category_id ?? "__none__"}>
                  <TableCell className="font-medium">
                    {c.category_name}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(c.item_count, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(c.total_quantity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.total_weight_chi > 0
                      ? formatNumber(c.total_weight_chi)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(c.total_value)}
                  </TableCell>
                </TableRow>
              ))}
              {report.byCategory.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Chưa có mặt hàng tồn nào (in_stock).
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Tổng</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatNumber(report.totals.item_count, 0)}
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
                  {formatVND(report.totals.total_value)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chi tiết mặt hàng</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhóm</TableHead>
                <TableHead>Tên mặt hàng</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">SL tồn</TableHead>
                <TableHead className="text-right">Trọng lượng</TableHead>
                <TableHead className="text-right">Đơn vị</TableHead>
                <TableHead className="text-right">Đơn giá nhập</TableHead>
                <TableHead className="text-right">Tổng giá vốn</TableHead>
                <TableHead>Ngày nhập</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.category_name}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs">{r.sku ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.quantity_on_hand)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.weight !== null ? formatNumber(r.weight) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.weight_unit ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.unit_cost)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.total_cost)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatVNDate(r.created_at)}
                  </TableCell>
                </TableRow>
              ))}
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Không có mặt hàng tồn nào.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ReportShell>
  );
}
