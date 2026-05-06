"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { InventoryRow } from "@/lib/inventory/queries";

type Props = {
  item: InventoryRow | null;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
};

export function InventoryArchiveDialog({ item, onOpenChange, onArchived }: Props) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const open = item !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!reason.trim()) {
      toast.error("Nhập lý do lưu trữ");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error("Không lưu trữ được", {
          description: err?.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast.success("Đã lưu trữ mặt hàng");
      setReason("");
      onOpenChange(false);
      onArchived();
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onOpenChange(false);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lưu trữ mặt hàng tồn</DialogTitle>
          <DialogDescription>
            {item
              ? `Mặt hàng "${item.name}" sẽ bị ẩn khỏi danh sách tồn kho. Hành động này có thể được khôi phục bằng cách đổi trạng thái sang "Còn hàng" trong nhật ký.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="reason">Lý do *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="vd: Hỏng, đã trả lại NCC"
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Lưu trữ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
