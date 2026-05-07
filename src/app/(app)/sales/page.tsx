import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatVND, formatVNDate, formatNumber } from "@/lib/utils";
import { SalesFilters } from "@/components/sales/sales-filters";
import { SalesPagination } from "@/components/sales/sales-pagination";
import { AlertCircle, ExternalLink } from "lucide-react";
import { clampPage, pageOffset, totalPagesOf } from "@/lib/pagination";

const PAGE_SIZE = 50;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    category?: string;
    status?: string;
    page?: string;
  };
}) {
  const supabase = createClient();

  const from = searchParams.from;
  const to = searchParams.to;
  const category = searchParams.category;
  const status = searchParams.status;
  const requestedPage = Number.parseInt(searchParams.page ?? "1", 10) || 1;

  let countQuery = supabase
    .from("sales_transactions")
    .select("id", { count: "exact", head: true });
  if (from) countQuery = countQuery.gte("sale_date", from);
  if (to) countQuery = countQuery.lte("sale_date", to);
  if (category) countQuery = countQuery.eq("product_category_id", category);
  if (
    status &&
    ["complete", "missing_purchase_cost", "estimated"].includes(status)
  ) {
    countQuery = countQuery.eq(
      "tax_calculation_status",
      status as "complete" | "missing_purchase_cost" | "estimated"
    );
  }
  const { count } = await countQuery;
  const totalCount = count ?? 0;
  const totalPages = totalPagesOf(totalCount, PAGE_SIZE);
  const page = clampPage(requestedPage, totalPages);
  const { from: rangeFrom, to: rangeTo } = pageOffset({ page, pageSize: PAGE_SIZE });

  let query = supabase
    .from("sales_transactions")
    .select(
      "id, sale_date, invoice_no, product_name_raw, quantity, weight, unit_price, total_amount, purchase_cost_amount, value_added_amount, tax_calculation_status, is_intentionally_ignored, product_category_id, category:product_categories(id, name, code)"
    )
    .order("sale_date", { ascending: false })
    .order("invoice_no", { ascending: true })
    .range(rangeFrom, rangeTo);

  if (from) query = query.gte("sale_date", from);
  if (to) query = query.lte("sale_date", to);
  if (category) query = query.eq("product_category_id", category);
  if (
    status &&
    ["complete", "missing_purchase_cost", "estimated"].includes(status)
  ) {
    query = query.eq(
      "tax_calculation_status",
      status as "complete" | "missing_purchase_cost" | "estimated"
    );
  }

  const { data: rows } = await query;
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name, code")
    .order("display_order");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Giao dịch bán</h1>
        <p className="text-sm text-muted-foreground">
          Danh sách giao dịch bán hàng. Cảnh báo dòng thiếu giá vốn để bổ sung
          tính thuế GTGT chính xác.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesFilters categories={categories ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Kết quả</CardTitle>
            <CardDescription>
              {formatNumber(totalCount, 0)} giao dịch • Trang {page}/{totalPages}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {(rows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có giao dịch nào phù hợp.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày</TableHead>
                      <TableHead>Hóa đơn</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>Phân loại</TableHead>
                      <TableHead className="text-right">SL</TableHead>
                      <TableHead className="text-right">TL (chỉ)</TableHead>
                      <TableHead className="text-right">Bán ra</TableHead>
                      <TableHead className="text-right">Mua vào</TableHead>
                      <TableHead className="text-right">GTGT</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rows ?? []).map((r) => {
                      const cat = Array.isArray(r.category) ? r.category[0] : r.category;
                      const isMissing =
                        r.tax_calculation_status === "missing_purchase_cost" ||
                        r.purchase_cost_amount === null ||
                        r.purchase_cost_amount === undefined;
                      const fixHref = `/issues/missing-cost?transactionId=${encodeURIComponent(
                        r.id
                      )}${r.is_intentionally_ignored ? "&include_ignored=1" : ""}`;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{formatVNDate(r.sale_date)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.invoice_no ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[280px] truncate">
                            {r.product_name_raw}
                          </TableCell>
                          <TableCell>
                            {cat ? (
                              <Badge variant="secondary">{cat.name}</Badge>
                            ) : (
                              <Badge variant="outline">Chưa phân loại</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.quantity), 2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.weight), 4)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatVND(Number(r.total_amount))}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.purchase_cost_amount === null ||
                            r.purchase_cost_amount === undefined ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="inline-flex items-center gap-1 text-destructive text-xs">
                                  <AlertCircle className="h-3 w-3" />
                                  Thiếu
                                </span>
                                <Link
                                  href={fixHref}
                                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                                  title="Xử lý thiếu giá vốn"
                                  aria-label="Xử lý thiếu giá vốn cho giao dịch này"
                                >
                                  Xử lý
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            ) : (
                              formatVND(Number(r.purchase_cost_amount))
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-right ${
                              Number(r.value_added_amount ?? 0) < 0
                                ? "text-destructive"
                                : ""
                            }`}
                          >
                            {r.value_added_amount === null
                              ? "—"
                              : formatVND(Number(r.value_added_amount))}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  r.tax_calculation_status === "complete"
                                    ? "success"
                                    : r.tax_calculation_status === "estimated"
                                    ? "warning"
                                    : "destructive"
                                }
                              >
                                {r.tax_calculation_status === "complete"
                                  ? "Đầy đủ"
                                  : r.tax_calculation_status === "estimated"
                                  ? "Ước tính"
                                  : "Thiếu giá vốn"}
                              </Badge>
                              {isMissing &&
                              r.purchase_cost_amount !== null &&
                              r.purchase_cost_amount !== undefined ? (
                                <Link
                                  href={fixHref}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline-offset-4 hover:underline"
                                  title="Xử lý thiếu giá vốn"
                                  aria-label="Xử lý thiếu giá vốn cho giao dịch này"
                                >
                                  Xử lý
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <SalesPagination
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={PAGE_SIZE}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
