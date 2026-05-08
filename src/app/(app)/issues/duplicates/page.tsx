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
import { findDuplicateGroups } from "@/lib/issues/queries";
import { formatNumber, formatVND } from "@/lib/utils";
import { DuplicateActions } from "@/components/issues/duplicate-actions";

export const dynamic = "force-dynamic";

export default async function DuplicateIssuesPage({
  searchParams,
}: {
  searchParams: { transactionId?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { groups } = await findDuplicateGroups(supabase, { limit: 1500 });
  const transactionId = searchParams.transactionId?.trim() || undefined;
  const highlightedGroup = transactionId
    ? groups.find((g) => g.row_ids.includes(transactionId))
    : undefined;

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
          Hóa đơn trùng / nghi ngờ
        </h1>
        <p className="text-sm text-muted-foreground">
          Hai loại được phát hiện: (1) cùng dòng sản phẩm xuất hiện nhiều lần
          trong một hóa đơn; (2) cùng số hóa đơn được dùng trên nhiều ký hiệu
          khác nhau. Trang chỉ xem để bạn xác minh thủ công, không tự xóa dòng.
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Không phát hiện hóa đơn trùng / nghi ngờ</CardTitle>
            <CardDescription>
              Trong phạm vi 1.500 dòng gần nhất.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {groups.length.toLocaleString("vi-VN")} nhóm cần kiểm tra
            </CardTitle>
            <CardDescription>
              Mỗi dòng dưới đây gom các bản ghi nghi trùng. Mở /sales với số
              hóa đơn tương ứng để xác minh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Loại</TableHead>
                  <TableHead className="w-32">Hóa đơn</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead className="text-right">Tổng nhóm</TableHead>
                  <TableHead className="text-right w-20">Số dòng</TableHead>
                  <TableHead className="text-right w-40">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const isHighlighted = highlightedGroup?.group_key === g.group_key;
                  const rowAnchorId = transactionId && g.row_ids.includes(transactionId)
                    ? `tx-${transactionId}`
                    : undefined;
                  return (
                    <TableRow
                      key={g.group_key}
                      id={rowAnchorId}
                      className={isHighlighted ? "bg-amber-50 ring-2 ring-amber-400" : undefined}
                    >
                    <TableCell>
                      {g.kind === "duplicate_within_invoice" ? (
                        <Badge variant="warning">Trùng trên hóa đơn</Badge>
                      ) : (
                        <Badge variant="secondary">
                          Trùng số HĐ trên nhiều ký hiệu
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {g.invoice_no ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">
                      {g.product_name_raw}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(g.quantity, 2)} {g.unit ?? ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVND(g.unit_price)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatVND(g.total_amount)}
                    </TableCell>
                    <TableCell className="text-right">{g.count}</TableCell>
                    <TableCell className="text-right">
                      <DuplicateActions
                        invoiceNo={g.invoice_no}
                        rowCount={g.count}
                        totalAmount={g.total_amount}
                        rowIds={g.row_ids}
                      />
                    </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
