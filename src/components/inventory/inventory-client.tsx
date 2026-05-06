"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Archive, Search, X } from "lucide-react";
import { formatNumber, formatVND, formatVNDate } from "@/lib/utils";
import {
  INVENTORY_SOURCE_TYPES,
  INVENTORY_STATUSES,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/lib/inventory/schema";
import type { InventoryRow } from "@/lib/inventory/queries";
import { InventoryForm, type CategoryOption } from "./inventory-form";
import { InventoryArchiveDialog } from "./archive-dialog";

type Props = {
  rows: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: CategoryOption[];
  filters: {
    category: string;
    status: string;
    source: string;
    missing_cost: boolean;
    low_stock: boolean;
    q_sku: string;
    q_name: string;
    from: string;
    to: string;
  };
  canArchive: boolean;
  canEdit: boolean;
};

const ALL = "__all__";

export function InventoryClient({
  rows,
  total,
  page,
  pageSize,
  categories,
  filters,
  canArchive,
  canEdit,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<InventoryRow | null>(null);
  const [pending, startTransition] = useTransition();

  // Local copies of filter inputs so the user can type before submitting.
  const [qSku, setQSku] = useState(filters.q_sku);
  const [qName, setQName] = useState(filters.q_name);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const updateUrl = (patch: Record<string, string | null | boolean>) => {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === false || v === "") {
        url.searchParams.delete(k);
      } else if (v === true) {
        url.searchParams.set(k, "1");
      } else {
        url.searchParams.set(k, v);
      }
    }
    url.searchParams.delete("page");
    startTransition(() => router.push(url.pathname + url.search));
  };

  const submitTextFilters = () => {
    updateUrl({ q_sku: qSku, q_name: qName, from, to });
  };

  const clearFilters = () => {
    setQSku("");
    setQName("");
    setFrom("");
    setTo("");
    startTransition(() => router.push("/inventory"));
  };

  const onSaved = () => {
    startTransition(() => router.refresh());
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tồn kho</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý mặt hàng tồn theo nhóm, trọng lượng, giá nhập. Có thể gắn
            mặt hàng tồn vào giao dịch bán để xác định giá vốn cho thuế GTGT.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={() => setCreating(true)} disabled={pending}>
            <Plus className="mr-1 h-4 w-4" />
            Thêm mặt hàng
          </Button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="rounded-md border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <Label htmlFor="f-category" className="text-xs">
              Nhóm
            </Label>
            <Select
              value={filters.category || ALL}
              onValueChange={(v) =>
                updateUrl({ category: v === ALL ? null : v })
              }
            >
              <SelectTrigger id="f-category">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value="none">Chưa phân loại</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="f-status" className="text-xs">
              Trạng thái
            </Label>
            <Select
              value={filters.status || "active"}
              onValueChange={(v) =>
                updateUrl({ status: v === ALL ? null : v })
              }
            >
              <SelectTrigger id="f-status">
                <SelectValue placeholder="Đang hoạt động" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Đang hoạt động</SelectItem>
                <SelectItem value={ALL}>Tất cả trạng thái</SelectItem>
                {INVENTORY_STATUSES.filter(
                  (s) => s !== "reserved" && s !== "written_off"
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="f-source" className="text-xs">
              Nguồn nhập
            </Label>
            <Select
              value={filters.source || ALL}
              onValueChange={(v) =>
                updateUrl({ source: v === ALL ? null : v })
              }
            >
              <SelectTrigger id="f-source">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả</SelectItem>
                {INVENTORY_SOURCE_TYPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.missing_cost}
                onChange={(e) =>
                  updateUrl({ missing_cost: e.target.checked })
                }
              />
              Thiếu giá mua
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.low_stock}
                onChange={(e) =>
                  updateUrl({ low_stock: e.target.checked })
                }
              />
              Tồn thấp
            </label>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="f-sku" className="text-xs">
              SKU
            </Label>
            <Input
              id="f-sku"
              value={qSku}
              onChange={(e) => setQSku(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitTextFilters();
              }}
              placeholder="NGOCTRAM-..."
            />
          </div>
          <div>
            <Label htmlFor="f-name" className="text-xs">
              Tên hàng
            </Label>
            <Input
              id="f-name"
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitTextFilters();
              }}
              placeholder="Tìm theo tên"
            />
          </div>
          <div>
            <Label htmlFor="f-from" className="text-xs">
              Từ ngày
            </Label>
            <Input
              id="f-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="f-to" className="text-xs">
              Đến ngày
            </Label>
            <Input
              id="f-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={pending}
          >
            <X className="mr-1 h-3 w-3" />
            Xoá lọc
          </Button>
          <Button type="button" size="sm" onClick={submitTextFilters} disabled={pending}>
            <Search className="mr-1 h-3 w-3" />
            Áp dụng
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Tên hàng</TableHead>
                <TableHead>Nhóm</TableHead>
                <TableHead>Loại sản phẩm</TableHead>
                <TableHead>Tuổi vàng</TableHead>
                <TableHead>ĐVT</TableHead>
                <TableHead className="text-right">SL hiện có</TableHead>
                <TableHead className="text-right">TL hiện có</TableHead>
                <TableHead className="text-right">Giá mua vào</TableHead>
                <TableHead className="text-right">Giá mua ĐV</TableHead>
                <TableHead className="text-right">Giá bán</TableHead>
                <TableHead>Nguồn</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày nhập</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={15}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Không có mặt hàng nào phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.sku ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate font-medium">{r.name}</div>
                      {r.notes ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {r.notes}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {r.category ? (
                        <Badge variant="secondary">{r.category.name}</Badge>
                      ) : (
                        <Badge variant="outline">Chưa phân loại</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.product_type ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.purity ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.unit ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.current_quantity ?? 0), 4)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.current_weight === null
                        ? "—"
                        : `${formatNumber(Number(r.current_weight), 4)} ${r.weight_unit}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.purchase_cost_amount === null ? (
                        <span className="text-xs text-destructive">Thiếu</span>
                      ) : (
                        formatVND(Number(r.purchase_cost_amount))
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.purchase_unit_price === null
                        ? "—"
                        : formatVND(Number(r.purchase_unit_price))}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.selling_price === null
                        ? "—"
                        : formatVND(Number(r.selling_price))}
                    </TableCell>
                    <TableCell className="text-xs">
                      {SOURCE_LABELS[r.source_type]}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatVNDate(r.imported_at ?? r.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(r)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {canArchive && r.status !== "archived" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setArchiving(r)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Trang {page + 1}/{totalPages} · {total.toLocaleString("vi-VN")} mặt hàng
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 0 || pending}
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("page", String(page - 1));
                startTransition(() => router.push(url.pathname + url.search));
              }}
            >
              ← Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages || pending}
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("page", String(page + 1));
                startTransition(() => router.push(url.pathname + url.search));
              }}
            >
              Sau →
            </Button>
          </div>
        </div>
      ) : null}

      <InventoryForm
        open={creating}
        onOpenChange={setCreating}
        categories={categories}
        editing={null}
        onSaved={onSaved}
      />
      <InventoryForm
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        categories={categories}
        editing={editing}
        onSaved={onSaved}
      />
      <InventoryArchiveDialog
        item={archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        onArchived={onSaved}
      />
    </>
  );
}

function StatusBadge({
  status,
}: {
  status: InventoryRow["status"];
}) {
  const variant: "success" | "destructive" | "warning" | "secondary" | "outline" =
    status === "in_stock"
      ? "success"
      : status === "partially_sold"
        ? "warning"
        : status === "sold" || status === "archived"
          ? "secondary"
          : status === "written_off"
            ? "destructive"
            : "outline";
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>;
}
