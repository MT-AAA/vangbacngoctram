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
import { loadCategoryOptions } from "@/lib/reports/categories";
import { loadCustomerPurchaseReport } from "@/lib/reports/customer-purchases";
import { formatVND, formatNumber, formatVNDate } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function getCategory(searchParams: SearchParams): string | null {
  const v = searchParams["category"];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function CustomerPurchasesReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const range = parseReportRange(searchParams);
  const category = getCategory(searchParams);
  const [report, categoryOptions] = await Promise.all([
    loadCustomerPurchaseReport(supabase, range, { categoryId: category }),
    loadCategoryOptions(supabase),
  ]);

  return (
    <ReportShell
      title="Báo cáo mua từ khách"
      description={`Liệt kê giao dịch mua vào của cửa hàng từ khách lẻ trong ${range.label}. Phần được đánh dấu Tax sẽ vào giá mua bình quân.`}
      range={range}
      showCategoryFilter
      categoryOptions={categoryOptions.map((c) => ({ id: c.id, name: c.name }))}
      category={category ?? undefined}
      csvSlug="customer-purchases"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tổng quan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="text-xs text-muted-foreground">Tất cả giao dịch</div>
              <div className="text-2xl font-semibold">
                {formatNumber(report.totals.row_count, 0)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Tổng tiền {formatVND(report.totals.total_amount)} · Trọng lượng{" "}
                {report.totals.weight_chi > 0
                  ? formatNumber(report.totals.weight_chi)
                  : "—"}{" "}
                chỉ
              </div>
            </div>
            <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 text-sm">
              <div className="text-xs text-emerald-900/70">
                Tính vào giá mua bình quân (Tax)
              </div>
              <div className="text-2xl font-semibold text-emerald-900">
                {formatNumber(report.taxInputTotals.row_count, 0)}
              </div>
              <div className="mt-1 text-xs text-emerald-900/70">
                Tổng tiền {formatVND(report.taxInputTotals.total_amount)} ·
                Trọng lượng{" "}
                {report.taxInputTotals.weight_chi > 0
                  ? formatNumber(report.taxInputTotals.weight_chi)
                  : "—"}{" "}
                chỉ
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chi tiết</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Khách</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Nhóm</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead className="text-right">Trọng lượng</TableHead>
                <TableHead className="text-right">Đơn vị</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead className="text-center">Tax</TableHead>
                <TableHead className="text-center">Tồn kho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">
                    {formatVNDate(r.purchase_date)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {r.customer_name ?? "—"}
                    </div>
                    {r.customer_phone ? (
                      <div className="text-xs text-muted-foreground">
                        {r.customer_phone}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{r.product_name}</TableCell>
                  <TableCell className="text-xs">{r.category_name}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.quantity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.weight !== null ? formatNumber(r.weight) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.weight_unit ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.unit_price)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatVND(r.total_amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.is_tax_purchase_input ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Tax
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.becomes_inventory ? (
                      <Badge variant="outline" className="text-[10px]">
                        Tồn
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Không có giao dịch mua từ khách trong khoảng đã chọn.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  Tổng
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatNumber(report.totals.quantity)}
                </TableCell>
                <TableCell colSpan={2} />
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
