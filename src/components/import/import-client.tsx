"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { categoryBadgeClassName } from "@/components/product-category-badge";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { formatVND, formatVNDate, formatNumber } from "@/lib/utils";

type PreviewRow = {
  source_stt: number | null;
  source_row_number: number;
  invoice_series: string | null;
  invoice_no: string | null;
  invoice_key: string;
  transaction_hash: string;
  sale_date: string | null;
  invoice_date: string | null;
  product_name_raw: string;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number | null;
  vat_output_amount_from_invoice: number | null;
  payment_status: string | null;
  invoice_status: string | null;
  tax_authority_status: string | null;
  errors: string[];
  classified_category_name?: string | null;
  matched_keyword?: string | null;
};

type PreviewResp = {
  rows: PreviewRow[];
  total_rows: number;
  data_row_count: number;
  header_row_number: number | null;
  recognized_columns: string[];
  unrecognized_columns: string[];
  total_amount: number;
  period_start: string | null;
  period_end: string | null;
  unique_invoice_count: number;
  transaction_hash_count: number;
  errors: string[];
};

type CommitResp = {
  total_rows: number;
  inserted: number;
  updated: number;
  errors: number;
  import_file_id: string;
  transaction_line_count: number;
  unique_invoice_count: number;
  total_amount: number;
  period_start: string | null;
  period_end: string | null;
};

export function ImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, startCommit] = useTransition();

  const handlePreview = async () => {
    if (!file) {
      toast.error("Vui lòng chọn file");
      return;
    }
    setIsPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.text();
        toast.error("Không đọc được file", { description: err });
        return;
      }
      const data = (await res.json()) as PreviewResp;
      setPreview(data);
      toast.success(
        `Đã đọc ${data.data_row_count} dòng (${data.unique_invoice_count} hóa đơn)`
      );
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommit = () => {
    if (!file || !preview) return;
    startCommit(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/commit", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.text();
        toast.error("Không lưu được dữ liệu", { description: err });
        return;
      }
      const data = (await res.json()) as CommitResp;
      toast.success("Nhập dữ liệu thành công", {
        description: `Mới: ${data.inserted} • Cập nhật: ${data.updated} • Lỗi: ${data.errors}`,
      });
      setFile(null);
      setPreview(null);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    });
  };

  const errorRows = preview?.rows.filter((r) => r.errors.length > 0) ?? [];
  const goodRows = preview?.rows.filter((r) => r.errors.length === 0) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-2">
          <Label htmlFor="file">Chọn file Excel</Label>
          <Input
            id="file"
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        </div>
        <div className="self-end">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={!file || isPreviewing}
          >
            {isPreviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Xem trước
          </Button>
        </div>
        <div className="self-end">
          <Button
            type="button"
            onClick={handleCommit}
            disabled={!preview || isCommitting || goodRows.length === 0}
          >
            {isCommitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu vào hệ thống
          </Button>
        </div>
      </div>

      {preview && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <SummaryStat
              label="Dòng hợp lệ"
              value={formatNumber(preview.data_row_count, 0)}
              tone="success"
            />
            <SummaryStat
              label="Hóa đơn duy nhất"
              value={formatNumber(preview.unique_invoice_count, 0)}
            />
            <SummaryStat
              label="Mã nhận diện giao dịch"
              value={formatNumber(preview.transaction_hash_count, 0)}
            />
            <SummaryStat
              label="Tổng doanh thu"
              value={formatVND(preview.total_amount)}
            />
            <SummaryStat
              label="Từ ngày"
              value={formatVNDate(preview.period_start)}
            />
            <SummaryStat
              label="Đến ngày"
              value={formatVNDate(preview.period_end)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SummaryStat
              label="Có lỗi"
              value={formatNumber(errorRows.length, 0)}
              tone={errorRows.length > 0 ? "warning" : "default"}
            />
            <SummaryStat
              label="Cột không nhận dạng"
              value={formatNumber(preview.unrecognized_columns.length, 0)}
            />
            <SummaryStat
              label="Dòng tiêu đề"
              value={
                preview.header_row_number === null
                  ? "—"
                  : `R${preview.header_row_number}`
              }
            />
          </div>

          {preview.unrecognized_columns.length > 0 && (
            <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
              <p className="font-medium">Một số cột chưa được nhận dạng và sẽ được lưu vào dữ liệu thô:</p>
              <p className="text-xs text-muted-foreground mt-1">
                {preview.unrecognized_columns.join(", ")}
              </p>
            </div>
          )}

          <div className="rounded-md border max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left">STT</th>
                  <th className="px-2 py-2 text-left">Ngày</th>
                  <th className="px-2 py-2 text-left">Ký hiệu</th>
                  <th className="px-2 py-2 text-left">Số HĐ</th>
                  <th className="px-2 py-2 text-left">Tên hàng hóa</th>
                  <th className="px-2 py-2 text-left">ĐVT</th>
                  <th className="px-2 py-2 text-right">SL</th>
                  <th className="px-2 py-2 text-right">Đơn giá</th>
                  <th className="px-2 py-2 text-right">Tổng cộng</th>
                  <th className="px-2 py-2 text-left">Phân loại</th>
                  <th className="px-2 py-2 text-left">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 200).map((r) => (
                  <tr
                    key={r.transaction_hash}
                    className={
                      r.errors.length > 0
                        ? "bg-destructive/5"
                        : "hover:bg-muted/40"
                    }
                  >
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {r.source_stt ?? "—"}
                    </td>
                    <td className="px-2 py-1.5">{formatVNDate(r.sale_date)}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {r.invoice_series ?? "—"}
                    </td>
                    <td className="px-2 py-1.5">{r.invoice_no ?? "—"}</td>
                    <td className="px-2 py-1.5 max-w-[280px] truncate">
                      {r.product_name_raw}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {r.unit ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {formatNumber(r.quantity, 2)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {formatVND(r.unit_price ?? null)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium">
                      {formatVND(r.total_amount ?? null)}
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {r.classified_category_name ? (
                        <Badge className={categoryBadgeClassName(r.classified_category_name)}>
                          {r.classified_category_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Cần xử lý</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.errors.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs">
                          <AlertCircle className="h-3 w-3" />
                          {r.errors.join("; ")}
                        </span>
                      ) : (
                        <span className="text-success text-xs">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 200 && (
              <div className="border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Chỉ hiển thị 200 dòng đầu tiên trong xem trước. Tổng có {preview.rows.length} dòng.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClasses =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${toneClasses}`}>{value}</p>
    </div>
  );
}
