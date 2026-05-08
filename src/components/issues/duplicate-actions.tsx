"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Combine, Split } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatVND } from "@/lib/utils";

type Props = {
  invoiceNo: string | null;
  rowCount: number;
  totalAmount: number;
  rowIds: string[];
};

export function DuplicateActions({ invoiceNo, rowCount, totalAmount, rowIds }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"merge" | "split" | null>(null);
  const [isPending, startTransition] = useTransition();

  function resolveDuplicate() {
    if (!mode) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/issues/duplicates/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowIds, mode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Xử lý thất bại");
        toast.success(mode === "merge" ? "Đã gộp hóa đơn" : "Đã tách hóa đơn");
        setMode(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xử lý thất bại");
      }
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" onClick={() => setMode("merge")}>
            <Combine className="mr-1 h-3.5 w-3.5" />
            Gộp
          </Button>
        </DialogTrigger>
        <Button size="sm" variant="outline" onClick={() => setMode("split")}>
          <Split className="mr-1 h-3.5 w-3.5" />
          Tách
        </Button>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "merge" ? "Gộp hóa đơn trùng" : "Tách hóa đơn trùng"}
            </DialogTitle>
            <DialogDescription>
              Thao tác này sẽ cập nhật dữ liệu thật và ghi nhật ký hệ thống.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">HĐ {invoiceNo ?? "—"}</Badge>
              <Badge variant="warning">{rowCount} dòng</Badge>
              <Badge variant="outline">{formatVND(totalAmount)}</Badge>
            </div>

            {mode === "merge" ? (
              <p className="text-muted-foreground">
                Gộp hóa đơn sẽ giữ dòng đầu làm dòng chính. Các dòng còn lại
                được đánh dấu bỏ qua có chủ ý với lý do hóa đơn trùng đã gộp.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Tách hóa đơn sẽ giữ số gốc cho dòng đầu và tạo số phụ cho các
                dòng còn lại, ví dụ: 255, 255a, 255b.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={isPending}>
              Đóng
            </Button>
            <Button onClick={resolveDuplicate} disabled={isPending}>
              {isPending ? "Đang xử lý..." : mode === "merge" ? "Xác nhận gộp" : "Xác nhận tách"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
