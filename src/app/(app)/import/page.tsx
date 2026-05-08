import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImportClient } from "@/components/import/import-client";
import { ImportRollbackButton } from "@/components/import/import-rollback-button";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatVND, formatVNDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function ImportPage() {
  const supabase = createClient();
  const { data: imports } = await supabase
    .from("import_files")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nhập dữ liệu Excel</h1>
        <p className="text-sm text-muted-foreground">
          Tải lên file Excel doanh thu (.xlsx, .xls). Hệ thống sẽ tự động chống
          trùng lặp dựa trên số hóa đơn hoặc hash của các trường chính.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tải lên file mới</CardTitle>
          <CardDescription>
            Hệ thống sử dụng các cột phổ biến: <em>Ngày bán, Số hóa đơn, Tên hàng,
            Số lượng, Trọng lượng, Đơn giá, Thành tiền, Giá vốn (mua vào), Khách
            hàng</em>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportClient />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử nhập gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          {(imports ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có lần nhập nào.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Tên file</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Kỳ</TableHead>
                  <TableHead className="text-right">Dòng GD</TableHead>
                  <TableHead className="text-right">Hóa đơn</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                  <TableHead className="text-right">Mới</TableHead>
                  <TableHead className="text-right">Cập nhật</TableHead>
                  <TableHead className="text-right">Lỗi</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(imports ?? []).map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell>{formatVNDate(imp.created_at)}</TableCell>
                    <TableCell className="font-medium">{imp.file_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          imp.status === "completed"
                            ? "success"
                            : imp.status === "failed" || imp.status === "rolled_back"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {imp.status === "completed"
                          ? "Hoàn tất"
                          : imp.status === "failed"
                          ? "Thất bại"
                          : imp.status === "processing"
                          ? "Đang xử lý"
                          : imp.status === "rolled_back"
                          ? "Đã xóa dữ liệu"
                          : "Đã tải lên"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {imp.period_start && imp.period_end
                        ? `${formatVNDate(imp.period_start)} → ${formatVNDate(imp.period_end)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {imp.transaction_line_count || imp.total_rows}
                    </TableCell>
                    <TableCell className="text-right">
                      {imp.unique_invoice_count || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {imp.total_amount ? formatVND(imp.total_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{imp.inserted_rows}</TableCell>
                    <TableCell className="text-right">{imp.updated_rows}</TableCell>
                    <TableCell className="text-right">{imp.error_rows}</TableCell>
                    <TableCell className="text-right align-top">
                      {imp.status === "completed" ? (
                        <ImportRollbackButton
                          importId={imp.id}
                          fileName={imp.file_name}
                          transactionCount={
                            imp.transaction_line_count || imp.total_rows || 0
                          }
                          totalAmount={imp.total_amount ?? 0}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
