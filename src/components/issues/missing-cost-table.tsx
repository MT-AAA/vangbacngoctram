"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  formatMoneyInput,
  formatNumber,
  formatVND,
  formatVNDate,
  parseVietnameseNumber,
} from "@/lib/utils";
import type { SaleIssueRow } from "@/lib/issues/queries";
import { InventoryPickerDialog } from "@/components/inventory/inventory-picker-dialog";

type Props = {
  rows: SaleIssueRow[];
  total: number;
  page: number;
  pageSize: number;
  includeIgnored: boolean;
  highlightId?: string;
  categoryCode?: string | null;
};

export function MissingCostTable({
  rows,
  total,
  page,
  pageSize,
  includeIgnored,
  highlightId,
  categoryCode,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkCost, setBulkCost] = useState("");
  const [bulkPickerLabel, setBulkPickerLabel] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [singleCost, setSingleCost] = useState("");
  const [pickerSale, setPickerSale] = useState<SaleIssueRow | null>(null);
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  const [highlightActive, setHighlightActive] = useState(false);

  useEffect(() => {
    if (!highlightId) return;
    const onPage = rows.some((r) => r.id === highlightId);
    if (!onPage) return;
    setHighlightActive(true);
    const node = highlightRef.current;
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, rows]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(() => (allChecked ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function postJSON(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function applyBulkCost() {
    const n = parseVietnameseNumber(bulkCost);
    if (n === null || n <= 0) {
      toast.error("Nhập số tiền hợp lệ (lớn hơn 0)");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Chọn ít nhất một dòng");
      return;
    }
    startTransition(async () => {
      try {
        await postJSON("/api/issues/sales/update-cost", {
          ids: selectedIds,
          purchase_cost_amount: n,
        });
        toast.success(`Đã cập nhật giá vốn cho ${selectedIds.length} dòng`);
        setSelected(new Set());
        setBulkCost("");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Cập nhật thất bại";
        toast.error(msg);
      }
    });
  }

  async function applySingleCost(id: string) {
    const n = parseVietnameseNumber(singleCost);
    if (n === null || n <= 0) {
      toast.error("Nhập giá vốn hợp lệ");
      return;
    }
    startTransition(async () => {
      try {
        await postJSON("/api/issues/sales/update-cost", {
          ids: [id],
          purchase_cost_amount: n,
        });
        toast.success("Đã cập nhật giá vốn");
        setEditingId(null);
        setSingleCost("");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Cập nhật thất bại";
        toast.error(msg);
      }
    });
  }

  async function unignore(id: string) {
    startTransition(async () => {
      try {
        await postJSON("/api/issues/sales/unignore", { ids: [id] });
        toast.success("Đã bỏ đánh dấu");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Cập nhật thất bại";
        toast.error(msg);
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (includeIgnored) params.set("include_ignored", "1");
    if (categoryCode) params.set("category", categoryCode);
    return `?${params.toString()}`;
  };

  const categoryHref = (code: string | null) => {
    const params = new URLSearchParams();
    params.set("page", "0");
    if (includeIgnored) params.set("include_ignored", "1");
    if (code) params.set("category", code);
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Thao tác hàng loạt {selectedIds.length > 0 ? `(${selectedIds.length} dòng đã chọn)` : ""}
        </div>
        <div className="mt-2 rounded-xl border border-amber-200/70 bg-white/45 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                Lọc nhanh theo nhóm hàng
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: null, label: "Tất cả" },
                  { code: "vang_ta", label: "Vàng ta" },
                  { code: "vang_tay", label: "Vàng tây" },
                  { code: "bac", label: "Bạc" },
                ].map((it) => {
                  const active = (categoryCode ?? null) === it.code;
                  return (
                    <Button
                      key={it.code ?? "all"}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => router.push(categoryHref(it.code))}
                    >
                      {it.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="lg:pt-5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkPickerLabel(`${selectedIds.length} dòng đã chọn`);
                  setBulkPickerOpen(true);
                }}
                disabled={pending || selectedIds.length === 0}
              >
                <Link2 className="mr-1 h-3.5 w-3.5" />
                Gắn tồn kho
              </Button>
            </div>
          </div>

          <div className="mt-3 border-t border-amber-200/70 pt-3">
            <Label htmlFor="bulk-cost" className="text-xs">
              Giá vốn cho mỗi dòng đã chọn
            </Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Input
                id="bulk-cost"
                placeholder="vd: 5.000.000"
                value={bulkCost}
                onChange={(e) => setBulkCost(formatMoneyInput(e.target.value))}
                inputMode="numeric"
                disabled={pending}
                className="sm:max-w-md"
              />
              <Button
                size="sm"
                onClick={applyBulkCost}
                disabled={pending || selectedIds.length === 0 || !bulkCost}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Áp dụng"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label="Chọn tất cả"
                checked={allChecked}
                onChange={toggleAll}
              />
            </TableHead>
            <TableHead className="w-28">Ngày</TableHead>
            <TableHead className="w-32">Hóa đơn</TableHead>
            <TableHead>Sản phẩm</TableHead>
            <TableHead className="text-right">SL</TableHead>
            <TableHead className="text-right">Đơn giá</TableHead>
            <TableHead className="text-right">Tổng</TableHead>
            <TableHead className="w-44">Trạng thái</TableHead>
            <TableHead className="w-56 text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isEditing = editingId === r.id;
            const ignored = r.is_intentionally_ignored;
            const isHighlighted = highlightId === r.id;
            const rowClass = [
              ignored ? "opacity-60" : "",
              isHighlighted && highlightActive
                ? "bg-amber-50 ring-2 ring-amber-400"
                : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <TableRow
                key={r.id}
                ref={isHighlighted ? highlightRef : undefined}
                className={rowClass || undefined}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${r.product_name_raw}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    disabled={ignored}
                  />
                </TableCell>
                <TableCell className="text-xs">
                  {formatVNDate(r.sale_date)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.invoice_series ? `${r.invoice_series}/` : ""}
                  {r.invoice_no ?? "—"}
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <div className="truncate font-medium">
                    {r.product_name_raw}
                  </div>
                  {r.customer_name ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {r.customer_name}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(r.quantity, 2)} {r.unit ?? ""}
                </TableCell>
                <TableCell className="text-right">
                  {formatVND(r.unit_price)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatVND(r.total_amount)}
                </TableCell>
                <TableCell>
                  {ignored ? (
                    <div>
                      <Badge variant="secondary">Đã bỏ qua</Badge>
                      {r.ignored_reason ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {r.ignored_reason}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <Badge variant="destructive">Thiếu giá vốn</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={singleCost}
                        onChange={(e) =>
                          setSingleCost(formatMoneyInput(e.target.value))
                        }
                        inputMode="numeric"
                        placeholder="Giá vốn"
                        className="h-8 w-32"
                        disabled={pending}
                      />
                      <Button
                        size="sm"
                        onClick={() => applySingleCost(r.id)}
                        disabled={pending}
                      >
                        Lưu
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setSingleCost("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : ignored ? (
                    <div className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unignore(r.id)}
                        disabled={pending}
                      >
                        Bỏ đánh dấu
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPickerSale(r)}
                      >
                        <Link2 className="mr-1 h-3.5 w-3.5" />
                        Gắn tồn kho
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(r.id);
                          setSingleCost("");
                        }}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Nhập giá vốn
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Trang {page + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 0}
              onClick={() => router.push(pageHref(page - 1))}
            >
              ← Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => router.push(pageHref(page + 1))}
            >
              Sau →
            </Button>
          </div>
        </div>
      )}

      <InventoryPickerDialog
        open={pickerSale !== null}
        onOpenChange={(o) => !o && setPickerSale(null)}
        saleId={pickerSale?.id ?? ""}
        saleProductName={pickerSale?.product_name_raw ?? null}
        saleCategoryId={pickerSale?.product_category_id ?? null}
        saleCategoryName={
          pickerSale && pickerSale.category
            ? Array.isArray(pickerSale.category)
              ? pickerSale.category[0]?.name ?? null
              : pickerSale.category.name ?? null
            : null
        }
        onLinked={() => router.refresh()}
      />
      <InventoryPickerDialog
        open={bulkPickerOpen}
        onOpenChange={setBulkPickerOpen}
        saleId={selectedIds[0] ?? ""}
        saleIds={selectedIds}
        saleProductName={bulkPickerLabel}
        saleCategoryId={null}
        saleCategoryName={null}
        onLinked={() => {
          setSelected(new Set());
          router.refresh();
        }}
      />
    </div>
  );
}
