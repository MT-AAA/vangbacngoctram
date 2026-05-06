"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { formatVND, formatVNDate, formatNumber } from "@/lib/utils";

type PreviewRow = {
  row_number: number;
  sale_date: string | null;
  invoice_no: string | null;
  product_name_raw: string;
  quantity: number | null;
  weight: number | null;
  unit_price: number | null;
  total_amount: number | null;
  purchase_cost_amount: number | null;
  errors: string[];
  classified_category_name?: string | null;
  matched_keyword?: string | null;
};

type PreviewResp = {
  rows: PreviewRow[];
  unrecognized_columns: string[];
  recognized_columns: Record<string, string>;
  total_rows: number;
};

type CommitResp = {
  total_rows: number;
  inserted: number;
  updated: number;
  errors: number;
  import_file_id: string;
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
      toast.success(`Đã đọc ${data.total_rows} dòng`);
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
      // Reload the page (history list will refresh)
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryStat label="Tổng dòng" value={formatNumber(preview.total_rows, 0)} />
            <SummaryStat
              label="Hợp lệ"
              value={formatNumber(goodRows.length, 0)}
              tone="success"
            />
            <SummaryStat
              label="Có lỗi"
              value={formatNumber(errorRows.length, 0)}
              tone={errorRows.length > 0 ? "warning" : "default"}
            />
            <SummaryStat
              label="Cột không nhận dạng"
              value={formatNumber(preview.unrecognized_columns.length, 0)}
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
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Ngày</th>
                  <th className="px-2 py-2 text-left">Hóa đơn</th>
                  <th className="px-2 py-2 text-left">Sản phẩm</th>
                  <th className="px-2 py-2 text-right">SL</th>
                  <th className="px-2 py-2 text-right">Trọng lượng</th>
                  <th className="px-2 py-2 text-right">Đơn giá</th>
                  <th className="px-2 py-2 text-right">Thành tiền</th>
                  <th className="px-2 py-2 text-right">Giá vốn</th>
                  <th className="px-2 py-2 text-left">Phân loại</th>
                  <th className="px-2 py-2 text-left">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 200).map((r) => (
                  <tr
                    key={r.row_number}
                    className={
                      r.errors.length > 0
                        ? "bg-destructive/5"
                        : "hover:bg-muted/40"
                    }
                  >
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {r.row_number}
                    </td>
                    <td className="px-2 py-1.5">{formatVNDate(r.sale_date)}</td>
                    <td className="px-2 py-1.5">{r.invoice_no ?? "—"}</td>
                    <td className="px-2 py-1.5 max-w-[280px] truncate">
                      {r.product_name_raw}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {formatNumber(r.quantity, 2)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {formatNumber(r.weight, 4)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {formatVND(r.unit_price ?? null)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium">
                      {formatVND(r.total_amount ?? null)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {formatVND(r.purchase_cost_amount ?? null)}
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {r.classified_category_name ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          {r.classified_category_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
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
