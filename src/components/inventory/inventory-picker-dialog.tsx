"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatVND } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/inventory/schema";
import type { InventoryRow } from "@/lib/inventory/queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  saleProductName: string | null;
  saleCategoryId: string | null;
  saleCategoryName: string | null;
  onLinked: () => void;
};

export function InventoryPickerDialog({
  open,
  onOpenChange,
  saleId,
  saleProductName,
  saleCategoryId,
  saleCategoryName,
  onLinked,
}: Props) {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ(saleProductName ?? "");
  }, [open, saleProductName]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (saleCategoryId) params.set("category_id", saleCategoryId);
    if (q) params.set("q", q);
    fetch(`/api/inventory/picker?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setItems((data.items ?? []) as InventoryRow[]);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, q, saleCategoryId]);

  const handleLink = async (inventory: InventoryRow, override = false) => {
    setLinking(inventory.id);
    try {
      const res = await fetch("/api/inventory/link-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sale_id: saleId,
          inventory_item_id: inventory.id,
          override_manual_cost: override,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === "CONFIRM_OVERWRITE_MANUAL_REQUIRED") {
          if (
            confirm(
              "Giao dịch này đã có giá vốn nhập tay. Ghi đè bằng giá vốn từ tồn kho?"
            )
          ) {
            return handleLink(inventory, true);
          }
          return;
        }
        toast.error("Không gắn được", {
          description: data?.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const warnings: string[] = data?.warnings ?? [];
      toast.success(
        `Đã gắn với mặt hàng tồn (giá vốn ${formatVND(Number(data?.cost ?? 0))})`,
        {
          description:
            warnings.length > 0
              ? warnings.join("; ")
              : `Tồn kho chuyển sang trạng thái: ${STATUS_LABELS[data?.new_inventory_status as keyof typeof STATUS_LABELS] ?? data?.new_inventory_status ?? "—"}`,
        }
      );
      onOpenChange(false);
      onLinked();
    } finally {
      setLinking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gắn với tồn kho</DialogTitle>
          <DialogDescription>
            {saleProductName ? (
              <>
                Chọn mặt hàng tồn để làm giá vốn cho{" "}
                <span className="font-medium">{saleProductName}</span>
                {saleCategoryName ? ` · ${saleCategoryName}` : ""}.
              </>
            ) : (
              "Chọn mặt hàng tồn để làm giá vốn cho giao dịch."
            )}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="picker-q" className="text-xs">
            Tìm theo tên
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="picker-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm..."
              className="pl-7"
            />
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang tải...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Không có mặt hàng tồn phù hợp.
            </div>
          ) : (
            items.map((it) => {
              const sameCategory =
                saleCategoryId && it.product_category_id === saleCategoryId;
              return (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{it.name}</span>
                      {it.category ? (
                        <Badge
                          variant={sameCategory ? "success" : "outline"}
                        >
                          {it.category.name}
                        </Badge>
                      ) : null}
                      <Badge variant="secondary" className="text-xs">
                        {STATUS_LABELS[it.status]}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="font-mono">{it.sku ?? "—"}</span>
                      {" · SL "}
                      {formatNumber(Number(it.current_quantity ?? 0), 4)}
                      {it.current_weight !== null
                        ? ` · TL ${formatNumber(Number(it.current_weight), 4)} ${it.weight_unit}`
                        : ""}
                    </div>
                    <div className="mt-0.5 text-xs">
                      Giá mua:{" "}
                      {it.purchase_cost_amount === null ? (
                        <span className="text-destructive">Chưa có</span>
                      ) : (
                        <span className="font-medium">
                          {formatVND(Number(it.purchase_cost_amount))}
                        </span>
                      )}
                      {it.purchase_unit_price !== null
                        ? ` · ĐV ${formatVND(Number(it.purchase_unit_price))}`
                        : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleLink(it)}
                    disabled={linking !== null}
                  >
                    {linking === it.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Chọn
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
