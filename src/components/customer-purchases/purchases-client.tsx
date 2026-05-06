"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatVND, formatVNDate } from "@/lib/utils";
import { PURITY_LABELS, type Purity } from "@/lib/customer-purchases/schema";
import type { CustomerPurchaseListRow } from "@/lib/customer-purchases/queries";
import {
  CustomerPurchaseForm,
  type CategoryOption,
} from "./purchase-form";

type Props = {
  rows: CustomerPurchaseListRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
  /** "admin" | "staff" | "viewer" — controls delete-button visibility. */
  role: string;
  filters: {
    from: string;
    to: string;
    category: string;
    q: string;
    customer: string;
    taxInput: string;
  };
};

export function CustomerPurchasesClient({
  rows,
  total,
  page,
  pageSize,
  categories,
  role,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [category, setCategory] = useState(filters.category || "all");
  const [q, setQ] = useState(filters.q);
  const [customer, setCustomer] = useState(filters.customer);
  const [taxInput, setTaxInput] = useState(filters.taxInput || "all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerPurchaseListRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomerPurchaseListRow | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const apply = () => {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (category && category !== "all") sp.set("category", category);
    if (q.trim()) sp.set("q", q.trim());
    if (customer.trim()) sp.set("customer", customer.trim());
    if (taxInput && taxInput !== "all") sp.set("tax_input", taxInput);
    router.push(`/customer-purchases${sp.toString() ? `?${sp}` : ""}`);
  };

  const reset = () => {
    setFrom("");
    setTo("");
    setCategory("all");
    setQ("");
    setCustomer("");
    setTaxInput("all");
    router.push("/customer-purchases");
  };

  const goToPage = (p: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(p));
    router.push(`/customer-purchases?${sp.toString()}`);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: CustomerPurchaseListRow) => {
    setEditing(row);
    setFormOpen(true);
  };

  const confirmDelete = (row: CustomerPurchaseListRow) => {
    setPendingDelete(row);
  };

  const runDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeleting(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/customer-purchases/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error("Xóa thất bại", {
            description: err?.error ?? `HTTP ${res.status}`,
          });
          return;
        }
        toast.success("Đã xóa giao dịch mua");
        setPendingDelete(null);
        router.refresh();
      } finally {
        setDeleting(false);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="space-y-1">
            <Label>Từ ngày</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Đến ngày</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Phân loại</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="none">Chưa phân loại</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tên sản phẩm</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="VD: Nhẫn 9999"
            />
          </div>
          <div className="space-y-1">
            <Label>Khách hàng</Label>
            <Input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Tên / SĐT / MST / CCCD"
            />
          </div>
          <div className="space-y-1">
            <Label>Tính giá vốn</Label>
            <Select value={taxInput} onValueChange={setTaxInput}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="1">Có tính</SelectItem>
                <SelectItem value="0">Không tính</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={apply} size="sm">
            Áp dụng
          </Button>
          <Button onClick={reset} variant="outline" size="sm">
            Xóa bộ lọc
          </Button>
          <div className="ml-auto">
            <Button onClick={openCreate} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Thêm giao dịch mua
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Sản phẩm</TableHead>
              <TableHead>Phân loại</TableHead>
              <TableHead>Tuổi</TableHead>
              <TableHead className="text-right">SL</TableHead>
              <TableHead className="text-right">Đơn giá</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead>Thuế</TableHead>
              <TableHead>Tồn kho</TableHead>
              <TableHead className="text-right w-[120px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">
                  Chưa có giao dịch nào phù hợp.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const cat = Array.isArray(r.category) ? r.category[0] : r.category;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatVNDate(r.purchase_date)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.customer_name ?? "—"}</div>
                      <div className="text-muted-foreground">
                        {[r.customer_phone, r.customer_tax_code, r.customer_id_card]
                          .filter(Boolean)
                          .join(" • ") || ""}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">
                      <div className="font-medium">{r.product_name}</div>
                      {r.unit && (
                        <div className="text-xs text-muted-foreground">
                          ĐV: {r.unit}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {cat ? (
                        <Badge variant="secondary">{cat.name}</Badge>
                      ) : (
                        <Badge variant="outline">Chưa phân loại</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.purity ? PURITY_LABELS[r.purity as Purity] ?? r.purity : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(Number(r.quantity ?? 0), 4)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatVND(Number(r.unit_price ?? 0))}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatVND(Number(r.total_amount ?? 0))}
                    </TableCell>
                    <TableCell>
                      {r.is_tax_purchase_input ? (
                        <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                          Có tính
                        </Badge>
                      ) : (
                        <Badge variant="outline">Không</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.becomes_inventory ? (
                        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                          Đã đưa vào
                        </Badge>
                      ) : (
                        <Badge variant="outline">Không</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(r)}
                          title="Sửa"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {role === "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDelete(r)}
                            title="Xóa"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Trang {page}/{totalPages} • Tổng {formatNumber(total, 0)} giao dịch
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Sau
          </Button>
        </div>
      </div>

      <CustomerPurchaseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        editing={editing}
        onSaved={() => {
          router.refresh();
        }}
      />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(v) => {
          if (!v && !deleting) setPendingDelete(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa giao dịch mua?</DialogTitle>
            <DialogDescription>
              {pendingDelete && (
                <>
                  {formatVNDate(pendingDelete.purchase_date)} •{" "}
                  {pendingDelete.product_name} •{" "}
                  {formatVND(Number(pendingDelete.total_amount ?? 0))}.
                  Hành động này không thể hoàn tác.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={runDelete}
              disabled={deleting || pending}
            >
              {(deleting || pending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
