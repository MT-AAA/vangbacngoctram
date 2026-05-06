import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImportClient } from "@/components/import/import-client";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatVNDate } from "@/lib/utils";
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
                  <TableHead className="text-right">Tổng dòng</TableHead>
                  <TableHead className="text-right">Mới</TableHead>
                  <TableHead className="text-right">Cập nhật</TableHead>
                  <TableHead className="text-right">Lỗi</TableHead>
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
                            : imp.status === "failed"
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
                          : "Đã tải lên"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{imp.total_rows}</TableCell>
                    <TableCell className="text-right">{imp.inserted_rows}</TableCell>
                    <TableCell className="text-right">{imp.updated_rows}</TableCell>
                    <TableCell className="text-right">{imp.error_rows}</TableCell>
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
