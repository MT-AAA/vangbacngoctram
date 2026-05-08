"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InventoryRow } from "@/lib/inventory/queries";

type Props = {
  item: InventoryRow | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function InventoryDeleteDialog({ item, onOpenChange, onDeleted }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const open = item !== null;

  const handleDelete = async () => {
    if (!item) return;
    setPending(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error("Không xóa được mặt hàng", {
          description: err?.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast.success("Đã xóa mặt hàng tồn kho");
      onOpenChange(false);
      onDeleted();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xóa mặt hàng tồn kho</DialogTitle>
          <DialogDescription>
            Thao tác này xóa hẳn mặt hàng khỏi tồn kho. Chỉ dùng khi nhập liệu
            sai và mặt hàng chưa gắn với giao dịch bán.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="font-medium">{item?.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            SKU: {item?.sku ?? "—"}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            Xóa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
