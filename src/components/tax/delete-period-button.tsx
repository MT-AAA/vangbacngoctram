"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
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

type Props = {
  periodId: string;
  periodName: string;
  periodLocked: boolean;
};

export function DeletePeriodButton({ periodId, periodName, periodLocked }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/tax/periods/${periodId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error("Không xóa được kỳ thuế", {
          description: err?.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast.success("Đã xóa kỳ thuế");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive"
        disabled={periodLocked}
        title={periodLocked ? "Kỳ đã khóa, không thể xóa" : "Xóa kỳ thuế"}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Xóa kỳ thuế</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa kỳ thuế</DialogTitle>
            <DialogDescription>
              Thao tác này sẽ xóa kỳ thuế và báo cáo thuế đã tính của kỳ này.
              Chỉ nên xóa khi tạo nhầm kỳ.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm font-medium">
            {periodName}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
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
    </>
  );
}
