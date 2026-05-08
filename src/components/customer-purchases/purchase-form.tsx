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
  PURITY_LABELS,
  PURITY_OPTIONS,
  UNIT_OPTIONS,
  type Purity,
} from "@/lib/customer-purchases/schema";
import {
  formatMoneyInput,
  formatVNDate,
  formatNumberForInput,
  parseVietnameseNumber,
} from "@/lib/utils";
import type { CustomerPurchaseListRow } from "@/lib/customer-purchases/queries";

export type CategoryOption = { id: string; name: string; code: string };

const PURITY_NONE = "__none__";
const CATEGORY_NONE = "__none__";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  /** When provided, the form runs in edit mode against this row. */
  editing?: CustomerPurchaseListRow | null;
  onSaved: () => void;
};

type FormState = {
  purchase_date: string;
  customer_name: string;
  customer_phone: string;
  customer_tax_code: string;
  customer_id_card: string;
  product_name: string;
  product_category_id: string;
  purity: string;
  unit: string;
  weight: string;
  weight_unit: string;
  quantity: string;
  unit_buy_price: string;
  total_buy_amount: string;
  is_tax_purchase_input: boolean;
  add_to_inventory: boolean;
  notes: string;
  image_url: string;
  attachment_url: string;
  /** True once the user has manually edited total_buy_amount (auto-calc disabled). */
  total_overridden: boolean;
};

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyForm(): FormState {
  return {
    purchase_date: todayIso(),
    customer_name: "",
    customer_phone: "",
    customer_tax_code: "",
    customer_id_card: "",
    product_name: "",
    product_category_id: CATEGORY_NONE,
    purity: PURITY_NONE,
    unit: "chỉ",
    weight: "",
    weight_unit: "chỉ",
    quantity: "1",
    unit_buy_price: "",
    total_buy_amount: "",
    is_tax_purchase_input: true,
    add_to_inventory: true,
    notes: "",
    image_url: "",
    attachment_url: "",
    total_overridden: false,
  };
}

function hydrateForm(row: CustomerPurchaseListRow): FormState {
  return {
    purchase_date: row.purchase_date,
    customer_name: row.customer_name ?? "",
    customer_phone: row.customer_phone ?? "",
    customer_tax_code: row.customer_tax_code ?? "",
    customer_id_card: row.customer_id_card ?? "",
    product_name: row.product_name ?? "",
    product_category_id: row.product_category_id ?? CATEGORY_NONE,
    purity: row.purity ?? PURITY_NONE,
    unit: row.unit ?? "chỉ",
    weight:
      row.weight !== null && row.weight !== undefined
        ? formatNumberForInput(Number(row.weight), 4)
        : "",
    weight_unit: row.weight_unit ?? "chỉ",
    quantity:
      row.quantity !== null && row.quantity !== undefined
        ? formatNumberForInput(Number(row.quantity), 4)
        : "1",
    unit_buy_price:
      row.unit_price !== null && row.unit_price !== undefined
        ? formatNumberForInput(Number(row.unit_price), 0)
        : "",
    total_buy_amount:
      row.total_amount !== null && row.total_amount !== undefined
        ? formatNumberForInput(Number(row.total_amount), 0)
        : "",
    is_tax_purchase_input: row.is_tax_purchase_input ?? true,
    add_to_inventory: row.becomes_inventory ?? true,
    notes: row.notes ?? "",
    image_url: row.image_url ?? "",
    attachment_url: row.attachment_url ?? "",
    total_overridden: true,
  };
}

export function CustomerPurchaseForm({
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
    setForm(editing ? hydrateForm(editing) : emptyForm());
  }, [open, editing]);

  // Auto-calc total_buy_amount from tax weight * unit_buy_price unless user
  // explicitly typed in the total field.
  const computedTotal = useMemo(() => {
    const weight = parseVietnameseNumber(form.weight);
    const unit = parseVietnameseNumber(form.unit_buy_price);
    if (weight === null || unit === null) return null;
    return weight * unit;
  }, [form.weight, form.unit_buy_price]);

  useEffect(() => {
    if (form.total_overridden) return;
    if (computedTotal === null) return;
    setForm((f) =>
      f.total_overridden
        ? f
        : {
            ...f,
            total_buy_amount: formatMoneyInput(Math.round(computedTotal)),
          }
    );
  }, [computedTotal, form.total_overridden]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const product = form.product_name.trim();
    if (!product) {
      toast.error("Vui lòng nhập tên sản phẩm");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.purchase_date)) {
      toast.error("Ngày mua không hợp lệ");
      return;
    }
    const quantity = parseVietnameseNumber(form.quantity);
    if (quantity === null || quantity <= 0) {
      toast.error("Số lượng phải lớn hơn 0");
      return;
    }
    const unitBuyPrice = parseVietnameseNumber(form.unit_buy_price);
    if (unitBuyPrice === null || unitBuyPrice < 0) {
      toast.error("Đơn giá mua không hợp lệ");
      return;
    }
    const weight = form.weight.trim()
      ? parseVietnameseNumber(form.weight)
      : null;
    if (weight !== null && (Number.isNaN(weight) || weight < 0)) {
      toast.error("Trọng lượng không hợp lệ");
      return;
    }
    const totalBuyAmount =
      parseVietnameseNumber(form.total_buy_amount) ??
      (weight !== null ? weight : quantity) * unitBuyPrice;
    if (totalBuyAmount < 0) {
      toast.error("Thành tiền không hợp lệ");
      return;
    }

    const payload = {
      purchase_date: form.purchase_date,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_tax_code: form.customer_tax_code,
      customer_id_card: form.customer_id_card,
      product_name: product,
      product_category_id:
        form.product_category_id === CATEGORY_NONE
          ? null
          : form.product_category_id,
      purity:
        form.purity === PURITY_NONE ? null : (form.purity as Purity),
      unit: form.unit,
      weight,
      weight_unit: form.weight_unit,
      quantity,
      unit_buy_price: unitBuyPrice,
      total_buy_amount: totalBuyAmount,
      is_tax_purchase_input: form.is_tax_purchase_input,
      add_to_inventory: form.add_to_inventory,
      notes: form.notes,
      image_url: form.image_url,
      attachment_url: form.attachment_url,
    };

    setPending(true);
    try {
      const url = editing
        ? `/api/customer-purchases/${editing.id}`
        : "/api/customer-purchases";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(editing ? "Cập nhật thất bại" : "Lưu thất bại", {
          description: data?.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const impact = data?.recalc_impact;
      if (impact?.affected_sales_count > 0) {
        toast.warning("Giao dịch mua ngày cũ có thể làm đổi giá vốn", {
          description: `${impact.affected_sales_count} hóa đơn bán từ ngày ${impact.earliest_sale_date} cần bấm tính lại giá vốn. ${impact.locked_period_count > 0 ? `${impact.locked_period_count} kỳ thuế đã khóa sẽ không tự cập nhật.` : ""}`,
          duration: 8000,
        });
      }
      toast.success(
        editing ? "Đã cập nhật giao dịch mua" : "Đã thêm giao dịch mua"
      );
      onOpenChange(false);
      onSaved();
    } finally {
      setPending(false);
    }
  };

  const friendlyDate = formatVNDate(form.purchase_date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Sửa giao dịch mua" : "Thêm giao dịch mua từ khách"}
          </DialogTitle>
          <DialogDescription>
            Ghi nhận giao dịch mua vàng/bạc/đá quý từ khách lẻ. Có thể đưa vào
            tồn kho và dùng làm đầu vào tính giá vốn bình quân.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="purchase_date">Ngày mua *</Label>
              <Input
                id="purchase_date"
                type="date"
                value={form.purchase_date}
                onChange={(e) => update("purchase_date", e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Hiển thị: {friendlyDate}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product_name">Tên sản phẩm *</Label>
              <Input
                id="product_name"
                value={form.product_name}
                onChange={(e) => update("product_name", e.target.value)}
                placeholder="VD: Nhẫn vàng 9999 1 chỉ"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Khách hàng</Label>
              <Input
                value={form.customer_name}
                onChange={(e) => update("customer_name", e.target.value)}
                placeholder="VD: Nguyễn Văn A"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Số điện thoại</Label>
              <Input
                value={form.customer_phone}
                onChange={(e) => update("customer_phone", e.target.value)}
                placeholder="0900 000 000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mã số thuế</Label>
              <Input
                value={form.customer_tax_code}
                onChange={(e) => update("customer_tax_code", e.target.value)}
                placeholder="MST"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CCCD / CMND</Label>
              <Input
                value={form.customer_id_card}
                onChange={(e) => update("customer_id_card", e.target.value)}
                placeholder="Số giấy tờ"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Phân loại</Label>
              <Select
                value={form.product_category_id}
                onValueChange={(v) => update("product_category_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chưa phân loại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATEGORY_NONE}>Chưa phân loại</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tuổi vàng / hàm lượng</Label>
              <Select
                value={form.purity}
                onValueChange={(v) => update("purity", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tuổi vàng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PURITY_NONE}>Không xác định</SelectItem>
                  {PURITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PURITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Đơn vị</Label>
              <Select
                value={form.unit}
                onValueChange={(v) => update("unit", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex min-h-5 items-center">Số lượng món *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => update("quantity", e.target.value)}
                placeholder="VD: 1"
                required
              />
              <p className="min-h-10 text-xs leading-5 text-muted-foreground">Số món/số dòng, không dùng thay trọng lượng tính thuế.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="flex min-h-5 items-center">Trọng lượng tính thuế</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.weight}
                onChange={(e) => update("weight", e.target.value)}
                placeholder="VD: 1,5"
              />
              <p className="min-h-10 text-xs leading-5 text-muted-foreground">Nhập số chỉ thực tế. Ví dụ 1,5 chỉ thì nhập 1,5.</p>
            </div>
            <div className="space-y-2">
              <Label className="flex min-h-5 items-center">ĐV trọng lượng</Label>
              <Select
                value={form.weight_unit}
                onValueChange={(v) => update("weight_unit", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chỉ">chỉ</SelectItem>
                  <SelectItem value="lượng">lượng</SelectItem>
                  <SelectItem value="gram">gram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex min-h-5 items-center">Đơn giá mua / chỉ *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.unit_buy_price}
                onChange={(e) =>
                  update("unit_buy_price", formatMoneyInput(e.target.value))
                }
                placeholder="VD: 6.500.000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="flex min-h-5 items-center">Thành tiền *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.total_buy_amount}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    total_buy_amount: formatMoneyInput(e.target.value),
                    total_overridden: true,
                  }));
                }}
                placeholder="Tự tính = Trọng lượng × Đơn giá"
              />
              {!form.total_overridden && computedTotal !== null && (
                <p className="min-h-5 text-xs leading-5 text-muted-foreground">Tự tính theo trọng lượng × đơn giá</p>
              )}
              {form.total_overridden && (
                <button
                  type="button"
                  className="text-xs text-emerald-700 underline-offset-4 hover:underline"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      total_overridden: false,
                      total_buy_amount:
                        computedTotal === null
                          ? ""
                          : formatMoneyInput(Math.round(computedTotal)),
                    }))
                  }
                >
                  Khôi phục tự tính
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
              <Checkbox
                id="is_tax_purchase_input"
                checked={form.is_tax_purchase_input}
                onCheckedChange={(v) =>
                  update("is_tax_purchase_input", v === true)
                }
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="is_tax_purchase_input" className="cursor-pointer">
                  Tính vào giá mua bình quân
                </Label>
                <p className="text-xs text-muted-foreground">
                  Khi bật, giao dịch này được dùng làm đầu vào cho phương pháp
                  thuế GTGT trực tiếp (giá mua bình quân).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
              <Checkbox
                id="add_to_inventory"
                checked={form.add_to_inventory}
                onCheckedChange={(v) => update("add_to_inventory", v === true)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="add_to_inventory" className="cursor-pointer">
                  Đưa vào tồn kho
                </Label>
                <p className="text-xs text-muted-foreground">
                  Tự động tạo / cập nhật mặt hàng tồn kho liên kết.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ảnh giao dịch (URL)</Label>
              <Input
                value={form.image_url}
                onChange={(e) => update("image_url", e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tài liệu đính kèm (URL)</Label>
              <Input
                value={form.attachment_url}
                onChange={(e) => update("attachment_url", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Ghi chú nội bộ"
            />
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
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Cập nhật" : "Lưu giao dịch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
