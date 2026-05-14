"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2, Pencil } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { InventoryPickerDialog } from "@/components/inventory/inventory-picker-dialog";
import { categoryBadgeClassName } from "@/components/product-category-badge";
import { formatMoneyInput, formatVND } from "@/lib/utils";

type Props = {
  transactionId: string;
  invoiceNo: string | null;
  productName: string;
  categoryId: string | null;
  categoryName: string | null;
  totalAmount: number;
  currentCost: number | null;
};

export function EditPurchaseCostDialog({
  transactionId,
  invoiceNo,
  productName,
  categoryId,
  categoryName,
  totalAmount,
  currentCost,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [cost, setCost] = useState(
    currentCost === null || currentCost === undefined
      ? ""
      : formatMoneyInput(Math.round(currentCost))
  );
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  async function submitManual() {
    const res = await fetch("/api/sales/purchase-cost/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: transactionId,
        purchase_cost_amount: cost,
        reason,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Không cập nhật được giá mua vào");
      return;
    }
    toast.success("Đã cập nhật giá mua vào thủ công");
    setManualOpen(false);
    setOpen(false);
    startTransition(() => router.refresh());
  }

  const parsedCost = Number(cost.replace(/\./g, "").replace(/,/g, "."));
  const previewValueAdded = Number.isFinite(parsedCost)
    ? totalAmount - parsedCost
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs">
            <Link2 className="h-3.5 w-3.5" />
            Đối soát
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Đối soát giá vốn</DialogTitle>
            <DialogDescription>
              Hóa đơn {invoiceNo ?? "—"}. Ưu tiên gắn với tồn kho để tự trừ kho
              và chuẩn dữ liệu thuế.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground line-clamp-2">{productName}</p>
              <p className="mt-1 text-muted-foreground">
                Bán ra: <strong>{formatVND(totalAmount)}</strong>
              </p>
              {categoryName ? (
                <Badge className={categoryBadgeClassName(categoryName)}>{categoryName}</Badge>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:bg-emerald-100"
            >
              <div className="flex items-center gap-2 font-semibold text-emerald-900">
                <Link2 className="h-4 w-4" />
                Gắn với tồn kho
              </div>
              <p className="mt-1 text-sm text-emerald-800">
                Tự tính giá vốn từ hàng tồn, trừ số lượng/trọng lượng trong kho.
                Nguồn giá vốn sẽ được ghi nhận là từ tồn kho.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setManualOpen((v) => !v)}
              className="w-full rounded-xl border bg-background p-4 text-left transition hover:bg-muted/40"
            >
              <div className="flex items-center gap-2 font-semibold">
                <Pencil className="h-4 w-4" />
                Nhập giá vốn thủ công
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Chỉ dùng khi không có dữ liệu tồn kho. Thao tác này không trừ kho.
              </p>
            </button>

            {manualOpen ? (
              <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-sm text-amber-900">
                  Lưu ý: nhập tay chỉ phục vụ tính thuế cho dòng bán này, không cập
                  nhật hàng tồn kho.
                </p>
                <div className="space-y-2">
                  <Label htmlFor={`purchase-cost-${transactionId}`}>Giá mua vào mới</Label>
                  <Input
                    id={`purchase-cost-${transactionId}`}
                    inputMode="decimal"
                    value={cost}
                    onChange={(e) => setCost(formatMoneyInput(e.target.value))}
                    placeholder="VD: 15.000.000"
                    disabled={pending}
                  />
                </div>
                {previewValueAdded !== null ? (
                  <p className="text-sm text-muted-foreground">
                    GTGT sau sửa: <strong>{formatVND(previewValueAdded)}</strong>
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor={`purchase-cost-reason-${transactionId}`}>Lý do chỉnh sửa</Label>
                  <Input
                    id={`purchase-cost-reason-${transactionId}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="VD: Không còn dữ liệu tồn kho gốc"
                    disabled={pending}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={submitManual} disabled={pending || !cost.trim() || !reason.trim()}>
                    Lưu nhập tay
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InventoryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        saleId={transactionId}
        saleProductName={productName}
        saleCategoryId={categoryId}
        saleCategoryName={categoryName}
        onLinked={() => {
          setPickerOpen(false);
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
