import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { listEstimated } from "@/lib/issues/queries";
import { formatNumber, formatVND, formatVNDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EstimatedIssuesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const page = Number.parseInt(searchParams.page ?? "0", 10) || 0;
  const { rows, total } = await listEstimated(supabase, { page, pageSize: 100 });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/issues"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Cần xử lý
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Đang tính theo ước tính
        </h1>
        <p className="text-sm text-muted-foreground">
          Các dòng có giá vốn được tính theo trung bình kho. Khi mở chức năng
          tồn kho, bạn có thể thay bằng giá vốn thực để báo cáo thuế chính xác
          hơn.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Không có dòng nào dùng giá vốn ước tính</CardTitle>
            <CardDescription>
              Mọi dòng đều có giá vốn thực hoặc đang chờ nhập.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {total.toLocaleString("vi-VN")} dòng dùng giá vốn ước tính
            </CardTitle>
            <CardDescription>
              Hiện chỉ xem được — chức năng thay giá vốn theo kho sẽ mở khi có
              module tồn kho.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Ngày</TableHead>
                  <TableHead className="w-32">Hóa đơn</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead className="text-right">Giá vốn</TableHead>
                  <TableHead className="w-32">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {formatVNDate(r.sale_date)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.invoice_series ? `${r.invoice_series}/` : ""}
                      {r.invoice_no ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {r.product_name_raw}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(r.quantity, 2)} {r.unit ?? ""}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatVND(r.total_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVND(r.purchase_cost_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning">Ước tính</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
