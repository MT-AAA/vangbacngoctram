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
import { AlertCircle, ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { clampPage, pageOffset, totalPagesOf } from "@/lib/pagination";
import { EditPurchaseCostDialog } from "@/components/sales/edit-purchase-cost-dialog";
import { findDuplicateGroups } from "@/lib/issues/queries";

const PAGE_SIZE = 50;

const SORT_FIELDS = [
  "sale_date",
  "invoice_no",
  "product_name_raw",
  "product_category_id",
  "weight",
  "total_amount",
  "purchase_cost_amount",
  "value_added_amount",
  "tax_calculation_status",
] as const;

type SortField = (typeof SORT_FIELDS)[number];
type SortDir = "asc" | "desc";

function isSortField(value: string | undefined): value is SortField {
  return SORT_FIELDS.includes(value as SortField);
}

function nextSortHref(
  searchParams: Record<string, string | undefined>,
  field: SortField,
  currentSort: SortField,
  currentDir: SortDir
) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") sp.set(key, value);
  }
  sp.set("sort", field);
  sp.set("dir", currentSort === field && currentDir === "asc" ? "desc" : "asc");
  return `/sales?${sp.toString()}`;
}

function SortHead({
  label,
  field,
  align = "left",
  searchParams,
  currentSort,
  currentDir,
}: {
  label: string;
  field: SortField;
  align?: "left" | "right";
  searchParams: Record<string, string | undefined>;
  currentSort: SortField;
  currentDir: SortDir;
}) {
  const active = currentSort === field;
  const Icon = currentDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <Link
        href={nextSortHref(searchParams, field, currentSort, currentDir)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        {label}
        {active ? <Icon className="h-3 w-3" /> : null}
      </Link>
    </TableHead>
  );
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    category?: string;
    status?: string;
    invoice?: string;
    sort?: string;
    dir?: string;
    page?: string;
  };
}) {
  const supabase = createClient();

  const from = searchParams.from;
  const to = searchParams.to;
  const category = searchParams.category;
  const status = searchParams.status;
  const invoice = searchParams.invoice?.trim();
  const sort = isSortField(searchParams.sort) ? searchParams.sort : "sale_date";
  const dir: SortDir = searchParams.dir === "asc" ? "asc" : "desc";
  const requestedPage = Number.parseInt(searchParams.page ?? "1", 10) || 1;

  let countQuery = supabase
    .from("sales_transactions")
    .select("id", { count: "exact", head: true })
    .or("duplicate_resolution_status.is.null,duplicate_resolution_status.neq.merged");
  if (from) countQuery = countQuery.gte("sale_date", from);
  if (to) countQuery = countQuery.lte("sale_date", to);
  if (category) countQuery = countQuery.eq("product_category_id", category);
  if (invoice) countQuery = countQuery.ilike("invoice_no", `%${invoice}%`);
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
      "id, sale_date, invoice_no, product_name_raw, quantity, weight, unit_price, total_amount, purchase_cost_amount, purchase_cost_edited_at, value_added_amount, tax_calculation_status, is_intentionally_ignored, product_category_id, category:product_categories(id, name, code)"
    )
    .or("duplicate_resolution_status.is.null,duplicate_resolution_status.neq.merged")
    .order(sort, { ascending: dir === "asc", nullsFirst: false });

  if (sort !== "sale_date") {
    query = query.order("sale_date", { ascending: false });
  }
  query = query.order("invoice_no", { ascending: true }).range(rangeFrom, rangeTo);

  if (from) query = query.gte("sale_date", from);
  if (to) query = query.lte("sale_date", to);
  if (category) query = query.eq("product_category_id", category);
  if (invoice) query = query.ilike("invoice_no", `%${invoice}%`);
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
  const duplicateGroups = await findDuplicateGroups(supabase, { limit: 5000 });
  const duplicateRowIds = new Set(
    duplicateGroups.groups.flatMap((group) => group.row_ids)
  );
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
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Kết quả</CardTitle>
            <CardDescription>
              {formatNumber(totalCount, 0)} giao dịch • Trang {page}/{totalPages}
            </CardDescription>
          </div>
          <div className="hidden lg:block">
            <SalesPagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              compact
            />
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
                      <SortHead label="Ngày" field="sale_date" searchParams={searchParams} currentSort={sort} currentDir={dir} />
                      <SortHead label="Hóa đơn" field="invoice_no" searchParams={searchParams} currentSort={sort} currentDir={dir} />
                      <SortHead label="Sản phẩm" field="product_name_raw" searchParams={searchParams} currentSort={sort} currentDir={dir} />
                      <SortHead label="Phân loại" field="product_category_id" searchParams={searchParams} currentSort={sort} currentDir={dir} />
                      <SortHead label="Số lượng (chỉ)" field="weight" align="right" searchParams={searchParams} currentSort={sort} currentDir={dir} />
                      <SortHead label="Bán ra" field="total_amount" align="right" searchParams={searchParams} currentSort={sort} currentDir={dir} />
                      <SortHead label="Mua vào" field="purchase_cost_amount" align="right" searchParams={searchParams} currentSort={sort} currentDir={dir} />
                      <SortHead label="GTGT" field="value_added_amount" align="right" searchParams={searchParams} currentSort={sort} currentDir={dir} />
                      <SortHead label="Trạng thái" field="tax_calculation_status" searchParams={searchParams} currentSort={sort} currentDir={dir} />
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rows ?? []).map((r) => {
                      const cat = Array.isArray(r.category) ? r.category[0] : r.category;
                      const displayWeight = r.weight ?? r.quantity;
                      const missingCostHref = `/issues/missing-cost?transactionId=${encodeURIComponent(
                        r.id
                      )}${r.is_intentionally_ignored ? "&include_ignored=1" : ""}`;
                      const unclassifiedHref = `/issues/unclassified?transactionId=${encodeURIComponent(
                        r.id
                      )}`;
                      const isDuplicate = duplicateRowIds.has(r.id);
                      const duplicateHref = `/issues/duplicates?transactionId=${encodeURIComponent(
                        r.id
                      )}#tx-${r.id}`;
                      const statusIssueHref = isDuplicate
                        ? duplicateHref
                        : !cat
                          ? unclassifiedHref
                          : null;
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
                            {displayWeight === null || displayWeight === undefined
                              ? "—"
                              : formatNumber(Number(displayWeight), 4)}
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
                                  href={missingCostHref}
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
                            <div className="flex flex-wrap items-center gap-2">
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
                              {!cat ? (
                                <Badge variant="warning">Chưa phân loại</Badge>
                              ) : null}
                              {isDuplicate ? (
                                <Badge variant="warning">Hóa đơn trùng</Badge>
                              ) : null}
                              {r.purchase_cost_edited_at ? (
                                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                                  Đã chỉnh sửa
                                </Badge>
                              ) : null}
                              {statusIssueHref ? (
                                <Link
                                  href={statusIssueHref}
                                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                                  title="Mở mục cần xử lý"
                                  aria-label="Mở mục cần xử lý cho giao dịch này"
                                >
                                  Xử lý
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <EditPurchaseCostDialog
                              transactionId={r.id}
                              invoiceNo={r.invoice_no}
                              productName={r.product_name_raw}
                              categoryId={r.product_category_id}
                              categoryName={cat?.name ?? null}
                              totalAmount={Number(r.total_amount ?? 0)}
                              currentCost={
                                r.purchase_cost_amount === null ||
                                r.purchase_cost_amount === undefined
                                  ? null
                                  : Number(r.purchase_cost_amount)
                              }
                            />
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
