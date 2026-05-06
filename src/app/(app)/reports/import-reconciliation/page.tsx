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
import { loadImportReconReport } from "@/lib/reports/import-reconciliation";
import { formatVND, formatNumber, formatVNDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ImportReconReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const range = parseReportRange(searchParams);
  const report = await loadImportReconReport(supabase, {
    from: range.from,
    to: range.to,
  });

  return (
    <ReportShell
      title="Đối soát file nhập"
      description={`So sánh expected (từ file Excel) với imported (đã ghi vào sales_transactions) cho mỗi file upload trong ${range.label}.`}
      range={range}
      csvSlug="import-reconciliation"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{range.label}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày upload</TableHead>
                <TableHead>Tên file</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Expected SL</TableHead>
                <TableHead className="text-right">Imported SL</TableHead>
                <TableHead className="text-right">Δ SL</TableHead>
                <TableHead className="text-right">Expected tiền</TableHead>
                <TableHead className="text-right">Imported tiền</TableHead>
                <TableHead className="text-right">Δ tiền</TableHead>
                <TableHead className="text-right">Mới</TableHead>
                <TableHead className="text-right">Cập nhật</TableHead>
                <TableHead className="text-right">Lỗi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">
                    {formatVNDate(r.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{r.file_name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "completed"
                          ? "success"
                          : r.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.expected_count, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.imported_count, 0)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      r.delta_count !== 0 ? "text-rose-700" : ""
                    )}
                  >
                    {r.delta_count > 0 ? "+" : ""}
                    {formatNumber(r.delta_count, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.expected_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.imported_amount)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      Math.abs(r.delta_amount) > 0.5 ? "text-rose-700" : ""
                    )}
                  >
                    {r.delta_amount > 0 ? "+" : ""}
                    {formatVND(r.delta_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.inserted_rows, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.updated_rows, 0)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      r.error_rows > 0 ? "text-rose-700 font-medium" : ""
                    )}
                  >
                    {formatNumber(r.error_rows, 0)}
                  </TableCell>
                </TableRow>
              ))}
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Không có file nào upload trong khoảng đã chọn.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  Tổng ({report.totals.files} file)
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatNumber(report.totals.expected_count, 0)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatNumber(report.totals.imported_count, 0)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold",
                    report.totals.delta_count !== 0 ? "text-rose-700" : ""
                  )}
                >
                  {report.totals.delta_count > 0 ? "+" : ""}
                  {formatNumber(report.totals.delta_count, 0)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.expected_amount)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatVND(report.totals.imported_amount)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold",
                    Math.abs(report.totals.delta_amount) > 0.5
                      ? "text-rose-700"
                      : ""
                  )}
                >
                  {report.totals.delta_amount > 0 ? "+" : ""}
                  {formatVND(report.totals.delta_amount)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Khi <strong>Δ SL ≠ 0</strong> hoặc <strong>Δ tiền ≠ 0</strong>: nghĩa là
        số dòng / tổng tiền đã ghi vào hệ thống KHÔNG khớp với số liệu trên file
        Excel ban đầu (có thể do trùng lặp đã merge, dòng lỗi, hoặc đã sửa thủ
        công). Kiểm tra lại lịch sử nhập và audit_logs để xác minh.
      </p>
    </ReportShell>
  );
}
