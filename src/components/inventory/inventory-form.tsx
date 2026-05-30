"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  formatMoneyInput,
  formatNumberForInput,
  parseVietnameseNumber,
} from "@/lib/utils";
import {
  INVENTORY_SOURCE_TYPES,
  INVENTORY_STATUSES,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/lib/inventory/schema";
import type { InventoryRow } from "@/lib/inventory/queries";

export type CategoryOption = { id: string; name: string; code: string };

const UNITS = ["chỉ", "lượng", "gram", "cái", "đôi"] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  editing?: InventoryRow | null;
  onSaved: () => void;
};

type FormState = {
  product_name: string;
  category_id: string;
  sku: string;
  product_type: string;
  purity: string;
  unit: string;
  weight_unit: string;
  initial_quantity: string;
  current_quantity: string;
  initial_weight: string;
  current_weight: string;
  purchase_unit_price: string;
  purchase_cost_amount: string;
  selling_price: string;
  source_type: string;
  source_reference: string;
  status: string;
  is_tax_cost_source: boolean;
  imported_at: string;
  note: string;
  attachment_url: string;
  cost_overridden: boolean;
  confirm_overwrite_cost: boolean;
};

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyForm(): FormState {
  return {
    product_name: "Tồn đầu kỳ Q2/2026 - ",
    category_id: "",
    sku: "",
    product_type: "Tồn đầu kỳ",
    purity: "",
    unit: "chỉ",
    weight_unit: "chỉ",
    initial_quantity: "1",
    current_quantity: "1",
    initial_weight: "",
    current_weight: "",
    purchase_unit_price: "",
    purchase_cost_amount: "",
    selling_price: "",
    source_type: "adjustment",
    source_reference: "TONDAU-Q2-2026",
    status: "in_stock",
    is_tax_cost_source: true,
    imported_at: "2026-04-01",
    note: "Tồn đầu kỳ Q2/2026 theo báo cáo kho cuối Q1/2026",
    attachment_url: "",
    cost_overridden: false,
    confirm_overwrite_cost: false,
  };
}

function hydrate(row: InventoryRow): FormState {
  return {
    product_name: row.name,
    category_id: row.product_category_id ?? "",
    sku: row.sku ?? "",
    product_type: row.product_type ?? "",
    purity: row.purity ?? "",
    unit: row.unit ?? "chỉ",
    weight_unit: row.weight_unit ?? "chỉ",
    initial_quantity:
      row.initial_quantity !== null && row.initial_quantity !== undefined
        ? formatNumberForInput(Number(row.initial_quantity), 4)
        : "",
    current_quantity:
      row.current_quantity !== null && row.current_quantity !== undefined
        ? formatNumberForInput(Number(row.current_quantity), 4)
        : "",
    initial_weight:
      row.initial_weight !== null && row.initial_weight !== undefined
        ? formatNumberForInput(Number(row.initial_weight), 4)
        : "",
    current_weight:
      row.current_weight !== null && row.current_weight !== undefined
        ? formatNumberForInput(Number(row.current_weight), 4)
        : "",
    purchase_unit_price:
      row.purchase_unit_price !== null && row.purchase_unit_price !== undefined
        ? formatNumberForInput(Number(row.purchase_unit_price), 0)
        : "",
    purchase_cost_amount:
      row.purchase_cost_amount !== null &&
      row.purchase_cost_amount !== undefined
        ? formatNumberForInput(Number(row.purchase_cost_amount), 0)
        : "",
    selling_price:
      row.selling_price !== null && row.selling_price !== undefined
        ? formatNumberForInput(Number(row.selling_price), 0)
        : "",
    source_type: row.source_type ?? "manual",
    source_reference: row.source_reference ?? "",
    status: row.status,
    is_tax_cost_source: row.is_tax_cost_source,
    imported_at: row.imported_at ? row.imported_at.slice(0, 10) : todayIso(),
    note: row.notes ?? "",
    attachment_url: row.attachment_url ?? "",
    cost_overridden: true,
    confirm_overwrite_cost: false,
  };
}

export function InventoryForm({
  open,
  onOpenChange,
  categories,
  editing,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [pending, setPending] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (initialized.current) return;
    initialized.current = true;
    setForm(editing ? hydrate(editing) : emptyForm());
  }, [open, editing]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Auto-calc purchase_cost_amount = unit_price × initial_weight when both
  // are set and the user hasn't manually overridden it.
  const computedCost = useMemo(() => {
    const u = parseVietnameseNumber(form.purchase_unit_price);
    const w = parseVietnameseNumber(form.initial_weight);
    if (u === null || w === null) return null;
    return u * w;
  }, [form.purchase_unit_price, form.initial_weight]);

  useEffect(() => {
    if (form.cost_overridden) return;
    if (computedCost === null) return;
    setForm((f) =>
      f.cost_overridden
        ? f
        : {
            ...f,
            purchase_cost_amount: formatMoneyInput(Math.round(computedCost)),
          }
    );
  }, [computedCost, form.cost_overridden]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const productName = form.product_name.trim();
    if (!productName) {
      toast.error("Vui lòng nhập tên hàng");
      return;
    }
    if (!form.category_id) {
      toast.error("Vui lòng chọn phân loại");
      return;
    }

    const initQty = parseVietnameseNumber(form.initial_quantity);
    const currQty = parseVietnameseNumber(form.current_quantity);
    const initWeight = form.initial_weight.trim()
      ? parseVietnameseNumber(form.initial_weight)
      : null;
    const currWeight = form.current_weight.trim()
      ? parseVietnameseNumber(form.current_weight)
      : null;
    const unitPrice = form.purchase_unit_price.trim()
      ? parseVietnameseNumber(form.purchase_unit_price)
      : null;
    const cost = form.purchase_cost_amount.trim()
      ? parseVietnameseNumber(form.purchase_cost_amount)
      : null;
    const sellingPrice = form.selling_price.trim()
      ? parseVietnameseNumber(form.selling_price)
      : null;

    if (currQty !== null && currQty < 0) {
      toast.error("Số lượng hiện có không được âm");
      return;
    }
    if (currWeight !== null && currWeight < 0) {
      toast.error("Trọng lượng hiện có không được âm");
      return;
    }

    if (form.is_tax_cost_source && (cost === null || cost < 0)) {
      toast.error("Hàng dùng làm giá vốn cần nhập giá mua vào");
      return;
    }

    const payload = {
      product_name: productName,
      category_id: form.category_id,
      sku: form.sku.trim() || null,
      product_type: form.product_type.trim() || null,
      purity: form.purity.trim() || null,
      unit: form.unit || null,
      weight_unit: form.weight_unit || null,
      initial_quantity: initQty,
      current_quantity: currQty ?? initQty,
      initial_weight: initWeight,
      current_weight: currWeight ?? initWeight,
      purchase_unit_price: unitPrice,
      purchase_cost_amount: cost,
      selling_price: sellingPrice,
      source_type: form.source_type,
      source_reference: form.source_reference.trim() || null,
      status: form.status,
      is_tax_cost_source: form.is_tax_cost_source,
      imported_at: form.imported_at
        ? new Date(form.imported_at + "T00:00:00").toISOString()
        : new Date().toISOString(),
      note: form.note.trim() || null,
      attachment_url: form.attachment_url.trim() || null,
      ...(editing && form.confirm_overwrite_cost
        ? { confirm_overwrite_cost: true }
        : {}),
    };

    setPending(true);
    try {
      const url = editing ? `/api/inventory/${editing.id}` : "/api/inventory";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err?.code === "CONFIRM_OVERWRITE_COST_REQUIRED") {
          update("confirm_overwrite_cost", true);
          toast.error(
            "Mặt hàng đã có giá mua. Bấm xác nhận ghi đè rồi lưu lại."
          );
          return;
        }
        toast.error(editing ? "Cập nhật thất bại" : "Tạo mới thất bại", {
          description: err?.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast.success(editing ? "Đã cập nhật" : "Đã tạo mặt hàng tồn");
      onOpenChange(false);
      onSaved();
    } finally {
      setPending(false);
    }
  };

  const NEW_STATUSES = INVENTORY_STATUSES.filter(
    (s) => s !== "reserved" && s !== "written_off"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Sửa tồn kho" : "Nhập tồn đầu kỳ / thêm tồn kho"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Cập nhật số lượng, trọng lượng và giá trị tồn. Mọi thay đổi đều được ghi vào nhật ký."
              : "Dùng để khởi tạo dữ liệu tồn ban đầu khi nhập lại cơ sở dữ liệu từ đầu. Nhập TL tồn ban đầu, tổng giá trị tồn và mốc thời gian khởi tạo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Gợi ý nhập tồn đầu kỳ Q2/2026</p>
            <p>
              Khởi tạo dữ liệu tồn ban đầu: chọn nhóm hàng, nhập TL tồn ban đầu,
              tổng giá trị tồn và mốc thời gian khởi tạo. Dữ liệu đã có sẽ không
              bị thay đổi; form này chỉ tạo/sửa dòng tồn bạn đang thao tác.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="product_name">Tên dòng tồn *</Label>
              <Input
                id="product_name"
                value={form.product_name}
                onChange={(e) => update("product_name", e.target.value)}
                placeholder="vd: Tồn đầu kỳ Q2/2026 - Vàng ta"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="category">Nhóm hàng *
</Label>
              <Select
                value={form.category_id || undefined}
                onValueChange={(v) => update("category_id", v)}
                disabled={pending}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Chọn nhóm" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => update("sku", e.target.value)}
                placeholder="Để trống để tự sinh"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="product_type">Loại dòng tồn</Label>
              <Input
                id="product_type"
                value={form.product_type}
                onChange={(e) => update("product_type", e.target.value)}
                placeholder="vd: Tồn đầu kỳ"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="purity">Tuổi vàng / Hàm lượng</Label>
              <Input
                id="purity"
                value={form.purity}
                onChange={(e) => update("purity", e.target.value)}
                placeholder="vd: 9999, 18K, 925"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="unit">ĐVT</Label>
              <Select
                value={form.unit}
                onValueChange={(v) => update("unit", v)}
                disabled={pending}
              >
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label htmlFor="initial_quantity" className="flex min-h-10 items-end">SL dòng ban đầu</Label>
              <Input
                id="initial_quantity"
                value={form.initial_quantity}
                onChange={(e) => update("initial_quantity", e.target.value)}
                placeholder="1"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="current_quantity" className="flex min-h-10 items-end">SL dòng hiện có</Label>
              <Input
                id="current_quantity"
                value={form.current_quantity}
                onChange={(e) => update("current_quantity", e.target.value)}
                placeholder="1"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="initial_weight" className="flex min-h-10 items-end">TL tồn ban đầu (chỉ)</Label>
              <Input
                id="initial_weight"
                value={form.initial_weight}
                onChange={(e) => update("initial_weight", e.target.value)}
                placeholder="vd: 106"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="current_weight" className="flex min-h-10 items-end">TL tồn hiện có (chỉ)</Label>
              <Input
                id="current_weight"
                value={form.current_weight}
                onChange={(e) => update("current_weight", e.target.value)}
                placeholder="vd: 106"
                disabled={pending}
              />
              <p className="min-h-10 text-xs leading-5 text-muted-foreground">Nếu để trống, hệ thống dùng bằng trọng lượng ban đầu.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="purchase_unit_price" className="flex min-h-5 items-center">Đơn giá bình quân / chỉ (VND)</Label>
              <Input
                id="purchase_unit_price"
                value={form.purchase_unit_price}
                onChange={(e) => {
                  update("purchase_unit_price", formatMoneyInput(e.target.value));
                }}
                placeholder="vd: 16.466.700"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="purchase_cost_amount" className="flex min-h-5 items-center">Tổng giá trị tồn (VND)</Label>
              <Input
                id="purchase_cost_amount"
                value={form.purchase_cost_amount}
                onChange={(e) => {
                  update("purchase_cost_amount", formatMoneyInput(e.target.value));
                  update("cost_overridden", true);
                }}
                placeholder="vd: 1.745.470.239"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="selling_price" className="flex min-h-5 items-center">Giá bán niêm yết (nếu có)</Label>
              <Input
                id="selling_price"
                value={form.selling_price}
                onChange={(e) => update("selling_price", formatMoneyInput(e.target.value))}
                placeholder="Không bắt buộc"
                disabled={pending}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="source_type">Nguồn nhập</Label>
              <Select
                value={form.source_type}
                onValueChange={(v) => update("source_type", v)}
                disabled={pending}
              >
                <SelectTrigger id="source_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_SOURCE_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="source_reference">Mã chứng từ</Label>
              <Input
                id="source_reference"
                value={form.source_reference}
                onChange={(e) => update("source_reference", e.target.value)}
                placeholder="TONDAU-Q2-2026"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="status">Trạng thái</Label>
              <Select
                value={form.status}
                onValueChange={(v) => update("status", v)}
                disabled={pending}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEW_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="imported_at">Mốc thời gian khởi tạo</Label>
              <Input
                id="imported_at"
                type="date"
                value={form.imported_at}
                onChange={(e) => update("imported_at", e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="attachment_url">Tệp đính kèm (URL)</Label>
              <Input
                id="attachment_url"
                value={form.attachment_url}
                onChange={(e) => update("attachment_url", e.target.value)}
                placeholder="https://..."
                disabled={pending}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="note">Ghi chú</Label>
            <Input
              id="note"
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
              placeholder="Ghi chú nội bộ"
              disabled={pending}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_tax_cost_source"
              checked={form.is_tax_cost_source}
              onCheckedChange={(v) =>
                update("is_tax_cost_source", v === true)
              }
              disabled={pending}
            />
            <Label htmlFor="is_tax_cost_source" className="cursor-pointer">
              Dùng tồn này làm giá vốn khi bán trong Q2
            </Label>
          </div>

          {editing && form.confirm_overwrite_cost ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3">
              <Checkbox
                id="confirm_overwrite_cost"
                checked={form.confirm_overwrite_cost}
                onCheckedChange={(v) =>
                  update("confirm_overwrite_cost", v === true)
                }
                disabled={pending}
              />
              <Label
                htmlFor="confirm_overwrite_cost"
                className="cursor-pointer text-sm"
              >
                Tôi xác nhận ghi đè giá mua đã nhập tay
              </Label>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Lưu thay đổi" : "Thêm mặt hàng"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
