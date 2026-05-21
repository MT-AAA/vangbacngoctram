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
import { formatVND, formatVNDate } from "@/lib/utils";
import { CreatePeriodForm } from "@/components/tax/create-period-form";
import { RecalcButton } from "@/components/tax/recalc-button";
import { ApplyAverageCostButton } from "@/components/tax/apply-average-cost-button";
import { DeletePeriodButton } from "@/components/tax/delete-period-button";

export default async function TaxReportsPage() {
  const supabase = createClient();
  const { data: periods } = await supabase
    .from("tax_periods")
    .select(
      "*, report:tax_reports(id, total_sales_amount, total_purchase_cost_amount, value_added_amount, negative_carried_in, taxable_value_added, vat_rate, vat_amount, negative_carried_out, transactions_missing_purchase_cost, transactions_estimated, calculated_at)"
    )
    .order("start_date", { ascending: false })
    .limit(60);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Báo cáo thuế GTGT — Phương pháp trực tiếp
        </h1>
        <p className="text-sm text-muted-foreground">
          Áp dụng cho hoạt động mua bán vàng, bạc, đá quý theo phương pháp trực
          tiếp trên giá trị gia tăng. Số âm trong kỳ được chuyển sang kỳ sau
          trong cùng năm dương lịch; cuối năm sẽ không được chuyển sang năm kế.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tạo kỳ tính thuế mới</CardTitle>
          <CardDescription>
            Chọn loại kỳ (tháng, quý, năm hoặc tùy chỉnh). Sau khi tạo, hệ thống
            sẽ tính giá trị gia tăng và bù trừ âm chuyển kỳ trong cùng năm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreatePeriodForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Các kỳ đã tạo</CardTitle>
          <CardDescription>
            Bấm <strong>Tính lại</strong> nếu bạn vừa nhập thêm dữ liệu hoặc cập
            nhật giá vốn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(periods ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có kỳ tính thuế nào.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kỳ</TableHead>
                    <TableHead>Khoảng thời gian</TableHead>
                    <TableHead className="text-right">Bán ra</TableHead>
                    <TableHead className="text-right">Mua vào</TableHead>
                    <TableHead className="text-right">GTGT</TableHead>
                    <TableHead className="text-right">Âm chuyển vào</TableHead>
                    <TableHead className="text-right">GTGT chịu thuế</TableHead>
                    <TableHead className="text-right">VAT phải nộp</TableHead>
                    <TableHead className="text-right">Âm chuyển ra</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(periods ?? []).map((p) => {
                    const r = Array.isArray(p.report) ? p.report[0] : p.report;
                    const hasMissing = (r?.transactions_missing_purchase_cost ?? 0) > 0;
                    const hasEstimated = (r?.transactions_estimated ?? 0) > 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatVNDate(p.start_date)} → {formatVNDate(p.end_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r ? formatVND(Number(r.total_sales_amount)) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r ? formatVND(Number(r.total_purchase_cost_amount)) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            Number(r?.value_added_amount ?? 0) < 0
                              ? "text-destructive"
                              : ""
                          }`}
                        >
                          {r ? formatVND(Number(r.value_added_amount)) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r ? formatVND(Number(r.negative_carried_in)) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r ? formatVND(Number(r.taxable_value_added)) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {r ? formatVND(Number(r.vat_amount)) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r ? formatVND(Number(r.negative_carried_out)) : "—"}
                        </TableCell>
                        <TableCell>
                          {!r ? (
                            <Badge variant="outline">Chưa tính</Badge>
                          ) : hasMissing ? (
                            <Badge variant="destructive">Thiếu giá vốn</Badge>
                          ) : hasEstimated ? (
                            <Badge variant="warning">Có ước tính</Badge>
                          ) : (
                            <Badge variant="success">Đầy đủ</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <RecalcButton periodId={p.id} />
                            <ApplyAverageCostButton
                              periodId={p.id}
                              periodLocked={p.is_locked}
                            />
                            <DeletePeriodButton
                              periodId={p.id}
                              periodName={p.name}
                              periodLocked={p.is_locked}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
