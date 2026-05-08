"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatVND } from "@/lib/utils";

type Props = {
  importId: string;
  fileName: string;
  transactionCount: number;
  totalAmount: number;
};

export function ImportRollbackButton({
  importId,
  fileName,
  transactionCount,
  totalAmount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  const canSubmit = confirmText.trim().toUpperCase() === "XOA";

  const handleRollback = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await fetch(`/api/import/${importId}/rollback`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast.error("Không xóa được dữ liệu", {
          description: payload?.error ?? "Vui lòng thử lại.",
        });
        return;
      }
      const payload = (await res.json()) as { deleted_sales_rows: number };
      toast.success("Đã xóa dữ liệu nhập Excel", {
        description: `Đã xóa ${payload.deleted_sales_rows.toLocaleString("vi-VN")} dòng giao dịch.`,
      });
      setOpen(false);
      setConfirmText("");
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" />
        Xóa dữ liệu
      </Button>
    );
  }

  return (
    <div className="min-w-[280px] rounded-lg border border-destructive/40 bg-destructive/5 p-3 shadow-sm">
      <p className="text-sm font-semibold text-destructive">
        Xóa dữ liệu lần nhập này?
      </p>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p className="line-clamp-2">File: {fileName}</p>
        <p>Dòng giao dịch: {transactionCount.toLocaleString("vi-VN")}</p>
        <p>Doanh thu: {formatVND(totalAmount)}</p>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor={`rollback-confirm-${importId}`} className="text-xs">
          Nhập <span className="font-semibold text-destructive">XOA</span> để xác nhận
        </Label>
        <Input
          id={`rollback-confirm-${importId}`}
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="XOA"
          className="h-8"
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(false);
            setConfirmText("");
          }}
          disabled={isPending}
        >
          Hủy
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleRollback}
          disabled={!canSubmit || isPending}
        >
          {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Xác nhận xóa
        </Button>
      </div>
    </div>
  );
}
