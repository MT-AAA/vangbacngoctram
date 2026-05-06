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
import { AlertCircle } from "lucide-react";

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
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  let query = supabase
    .from("sales_transactions")
    .select(
      "id, sale_date, invoice_no, product_name_raw, quantity, weight, unit_price, total_amount, purchase_cost_amount, value_added_amount, tax_calculation_status, product_category_id, category:product_categories(id, name, code)",
      { count: "exact" }
    )
    .order("sale_date", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

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

  const { data: rows, count } = await query;
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name, code")
    .order("display_order");

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

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
              {formatNumber(count ?? 0, 0)} giao dịch • Trang {page}/{totalPages}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {(rows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có giao dịch nào phù hợp.
            </p>
          ) : (
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
                          <span className="inline-flex items-center gap-1 text-destructive text-xs">
                            <AlertCircle className="h-3 w-3" />
                            Thiếu
                          </span>
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
