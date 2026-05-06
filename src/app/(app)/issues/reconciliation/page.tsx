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
import { findReconciliationWarnings } from "@/lib/issues/queries";
import { formatVND, formatVNDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReconciliationIssuesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { rows } = await findReconciliationWarnings(supabase);

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
          Đối soát file nhập
        </h1>
        <p className="text-sm text-muted-foreground">
          Danh sách file đã import có dòng lỗi hoặc số dòng commit chưa khớp
          với số dòng đọc được. Mở chi tiết tại trang Nhập Excel để kiểm tra.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tất cả file nhập đều khớp</CardTitle>
            <CardDescription>
              Không có cảnh báo đối soát trong các file gần đây.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{rows.length} file có cảnh báo</CardTitle>
            <CardDescription>
              Cảnh báo bao gồm: nhập thất bại, có dòng lỗi, hoặc tổng dòng đã
              commit khác với số dòng đọc được.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Ngày nhập</TableHead>
                  <TableHead>Tên file</TableHead>
                  <TableHead className="text-right">Đọc được</TableHead>
                  <TableHead className="text-right">Mới + Cập nhật</TableHead>
                  <TableHead className="text-right">Lỗi</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Cảnh báo</TableHead>
                  <TableHead className="text-right">Mở</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {formatVNDate(r.created_at)}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate font-medium">
                      {r.file_name}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.transaction_line_count}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.inserted_rows + r.updated_rows}
                    </TableCell>
                    <TableCell className="text-right">{r.error_rows}</TableCell>
                    <TableCell className="text-right">
                      {formatVND(r.total_amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.warnings.map((w, i) => (
                          <Badge key={i} variant="warning">
                            {w}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href="/import"
                        className="text-xs text-primary underline-offset-4 hover:underline"
                      >
                        Mở
                      </Link>
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
