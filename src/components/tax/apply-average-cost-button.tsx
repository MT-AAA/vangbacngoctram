"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { formatNumber, formatVND, formatVNDate } from "@/lib/utils";
import type { AveragePreview } from "@/lib/tax/average-cost";

type Props = {
  periodId: string;
  periodLocked?: boolean;
};

const ROW_PREVIEW_LIMIT = 25;

export function ApplyAverageCostButton({ periodId, periodLocked }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<AveragePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingApply, startApply] = useTransition();

  async function loadPreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch(
        `/api/tax/periods/${periodId}/apply-average-cost`,
        { method: "GET" }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Không thể tải xem trước");
        return;
      }
      setPreview(json.preview as AveragePreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      void loadPreview();
    } else {
      setPreview(null);
      setError(null);
    }
  }

  function handleApply() {
    if (!preview || preview.affected_rows.length === 0) return;
    startApply(async () => {
      try {
        const res = await fetch(
          `/api/tax/periods/${periodId}/apply-average-cost`,
          { method: "POST" }
        );
        const json = await res.json();
        if (!res.ok) {
          toast.error("Áp dụng thất bại", {
            description: json.error ?? "Lỗi không xác định",
          });
          return;
        }
        toast.success(
          `Đã áp dụng giá bình quân cho ${(json.updated as number).toLocaleString(
            "vi-VN"
          )} dòng`,
          {
            description:
              (json.skipped as number) > 0
                ? `Bỏ qua ${(json.skipped as number).toLocaleString(
                    "vi-VN"
                  )} dòng do đã có giá vốn thực.`
                : undefined,
          }
        );
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error("Áp dụng thất bại", {
          description: e instanceof Error ? e.message : "Lỗi không xác định",
        });
      }
    });
  }

  const rowsForPreview = preview?.affected_rows ?? [];
  const previewRows = rowsForPreview.slice(0, ROW_PREVIEW_LIMIT);
  const remainingRows = Math.max(
    0,
    rowsForPreview.length - previewRows.length
  );
  const canApply =
    !!preview &&
    !preview.period.is_locked &&
    preview.affected_rows.length > 0 &&
    !pendingApply;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        size="sm"
        variant="outline"
        disabled={periodLocked}
        onClick={() => handleOpenChange(true)}
        title={
          periodLocked
            ? "Kỳ đã khóa, không thể áp dụng giá bình quân"
            : "Ước tính giá vốn từ giá mua bình quân của khách"
        }
      >
        <Sparkles className="h-3 w-3" />
        <span className="ml-1">Giá bình quân</span>
      </Button>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Áp dụng giá mua bình quân cho kỳ này</DialogTitle>
          <DialogDescription>
            Ước tính giá vốn cho các dòng bán còn thiếu, lấy theo giá mua bình
            quân từ khách lẻ trong cùng kỳ và cùng nhóm sản phẩm. Các dòng đã
            có giá vốn thực (nhập tay / kho / Excel) sẽ KHÔNG bị ghi đè.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tính xem trước…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {preview && !loading && (
          <PreviewBody
            preview={preview}
            previewRows={previewRows}
            remainingRows={remainingRows}
          />
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pendingApply}
          >
            Hủy
          </Button>
          <Button
            disabled={!canApply}
            onClick={handleApply}
          >
            {pendingApply ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            <span className={pendingApply ? "ml-2" : ""}>
              Áp dụng cho kỳ này
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({
  preview,
  previewRows,
  remainingRows,
}: {
  preview: AveragePreview;
  previewRows: AveragePreview["affected_rows"];
  remainingRows: number;
}) {
  const { period, categories, totals } = preview;

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <div className="font-medium">{period.name}</div>
        <div className="text-xs text-muted-foreground">
          {formatVNDate(period.start_date)} → {formatVNDate(period.end_date)}
          {period.is_locked ? (
            <Badge variant="secondary" className="ml-2">
              Đã khóa
            </Badge>
          ) : null}
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-900">
          Chưa có giao dịch <strong>mua từ khách</strong> nào trong kỳ
          (đã bật &quot;Tính vào giá mua bình quân&quot;). Hãy thêm giao dịch
          ở mục{" "}
          <em>Mua từ khách</em> trước khi áp dụng.
        </div>
      ) : (
        <div>
          <div className="mb-1 text-sm font-medium">
            Giá mua bình quân theo nhóm sản phẩm
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhóm</TableHead>
                <TableHead className="text-right">Tổng tiền mua</TableHead>
                <TableHead className="text-right">Tổng SL mua</TableHead>
                <TableHead className="text-right">Đơn giá BQ</TableHead>
                <TableHead className="text-right">Số GD nguồn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.category_id ?? "none"}>
                  <TableCell className="font-medium">
                    {c.category_name}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(c.total_purchase_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(c.total_purchase_quantity, 4)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatVND(c.average_purchase_price)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {c.source_purchase_count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-sm font-medium">
            Dòng bán bị ảnh hưởng (
            {totals.affected_count.toLocaleString("vi-VN")})
          </div>
          <div className="text-xs text-muted-foreground">
            {totals.skipped_no_average_count > 0 && (
              <>
                {totals.skipped_no_average_count.toLocaleString("vi-VN")} dòng
                không có dữ liệu bình quân
              </>
            )}
            {totals.skipped_no_category_count > 0 && (
              <>
                {totals.skipped_no_average_count > 0 ? " · " : ""}
                {totals.skipped_no_category_count.toLocaleString("vi-VN")} dòng
                chưa phân loại
              </>
            )}
          </div>
        </div>

        {previewRows.length === 0 ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Không có dòng bán nào thiếu giá vốn để áp dụng giá bình quân trong
            kỳ này.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Ngày</TableHead>
                <TableHead className="w-28">Hóa đơn</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead className="text-right">Tổng bán</TableHead>
                <TableHead className="text-right">Giá vốn ƯT</TableHead>
                <TableHead className="text-right">GTGT ƯT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">
                    {formatVNDate(r.sale_date)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.invoice_series ? `${r.invoice_series}/` : ""}
                    {r.invoice_no ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">
                    <span className="block truncate">
                      {r.product_name_raw}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {r.category_name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.quantity, 2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.total_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(r.estimated_purchase_cost)}
                  </TableCell>
                  <TableCell
                    className={`text-right ${
                      r.estimated_value_added < 0
                        ? "text-rose-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {formatVND(r.estimated_value_added)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {remainingRows > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            … và {remainingRows.toLocaleString("vi-VN")} dòng nữa sẽ được áp
            dụng cùng lúc.
          </p>
        )}
      </div>

      <div className="rounded-md border bg-emerald-50 p-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <div className="text-xs text-emerald-900/70">
              Tổng dòng áp dụng
            </div>
            <div className="font-semibold text-emerald-900">
              {totals.affected_count.toLocaleString("vi-VN")}
            </div>
          </div>
          <div>
            <div className="text-xs text-emerald-900/70">
              Tổng giá vốn ước tính
            </div>
            <div className="font-semibold text-emerald-900">
              {formatVND(totals.total_estimated_cost)}
            </div>
          </div>
          <div>
            <div className="text-xs text-emerald-900/70">
              Tổng GTGT ước tính tăng thêm
            </div>
            <div
              className={`font-semibold ${
                totals.total_estimated_value_added < 0
                  ? "text-rose-700"
                  : "text-emerald-900"
              }`}
            >
              {formatVND(totals.total_estimated_value_added)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
