"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

export function RecalcButton({ periodId }: { periodId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await fetch(`/api/tax/periods/${periodId}/recalc`, {
            method: "POST",
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            toast.error("Tính lại thất bại", {
              description: err.error ?? "Lỗi không xác định",
            });
            return;
          }
          toast.success("Đã tính lại kỳ");
          router.refresh();
        })
      }
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      <span className="ml-1">Tính lại</span>
    </Button>
  );
}
