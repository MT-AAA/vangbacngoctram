"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatVND, formatVNDate } from "@/lib/utils";
import type { SaleIssueRow } from "@/lib/issues/queries";

type Category = { id: string; name: string; code: string };

type Props = {
  rows: SaleIssueRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: Category[];
  canCreateRule: boolean;
};

export function UnclassifiedTable({
  rows,
  total,
  page,
  pageSize,
  categories,
  canCreateRule,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [ruleCategoryId, setRuleCategoryId] = useState<string>("");
  const [ruleKeyword, setRuleKeyword] = useState("");
  const [reclassify, setReclassify] = useState(true);
  const [pending, startTransition] = useTransition();

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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error ?? `HTTP ${res.status}`
      );
    }
    return data;
  }

  async function applyBulkCategory() {
    if (!bulkCategoryId) {
      toast.error("Chọn nhóm sản phẩm");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Chọn ít nhất một dòng");
      return;
    }
    startTransition(async () => {
      try {
        await postJSON("/api/issues/sales/assign-category", {
          ids: selectedIds,
          category_id: bulkCategoryId,
        });
        toast.success(`Đã gán nhóm cho ${selectedIds.length} dòng`);
        setSelected(new Set());
        setBulkCategoryId("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
      }
    });
  }

  function fillRuleFromRow(row: SaleIssueRow) {
    setRuleKeyword(row.product_name_raw.toLowerCase());
  }

  async function createRule() {
    if (!canCreateRule) {
      toast.error("Chỉ quản trị viên được tạo quy tắc phân loại");
      return;
    }
    const keyword = ruleKeyword.trim();
    if (!keyword) {
      toast.error("Nhập từ khóa cho quy tắc");
      return;
    }
    if (!ruleCategoryId) {
      toast.error("Chọn nhóm sản phẩm cho quy tắc");
      return;
    }
    startTransition(async () => {
      try {
        const data = (await postJSON("/api/issues/rules/create", {
          keyword,
          category_id: ruleCategoryId,
          reclassify,
        })) as { reclassified?: number };
        toast.success(
          reclassify
            ? `Đã tạo quy tắc và phân loại lại ${
                data.reclassified ?? 0
              } dòng`
            : "Đã tạo quy tắc"
        );
        setRuleKeyword("");
        setRuleCategoryId("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo quy tắc thất bại");
      }
    });
  }

  async function reclassifyAll() {
    if (!canCreateRule) {
      toast.error("Chỉ quản trị viên được chạy phân loại lại");
      return;
    }
    startTransition(async () => {
      try {
        const data = (await postJSON("/api/issues/sales/reclassify", {
          scope: "unclassified",
        })) as { reclassified?: number };
        toast.success(
          `Đã phân loại lại ${data.reclassified ?? 0} dòng chưa phân loại`
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Phân loại lại thất bại"
        );
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (p: number) => `?page=${p}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Gán nhóm cho dòng đã chọn{" "}
            {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Nhóm sản phẩm</Label>
              <Select
                value={bulkCategoryId}
                onValueChange={setBulkCategoryId}
              >
                <SelectTrigger>
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
            <Button
              size="sm"
              onClick={applyBulkCategory}
              disabled={
                pending || selectedIds.length === 0 || !bulkCategoryId
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Áp dụng"}
            </Button>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tạo quy tắc phân loại
            </div>
            {canCreateRule && (
              <Button
                size="sm"
                variant="ghost"
                onClick={reclassifyAll}
                disabled={pending}
              >
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                Phân loại lại tất cả
              </Button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <div>
              <Label className="text-xs">Từ khóa</Label>
              <Input
                placeholder="vd: lắc tay"
                value={ruleKeyword}
                onChange={(e) => setRuleKeyword(e.target.value)}
                disabled={!canCreateRule || pending}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Gán vào nhóm</Label>
                <Select
                  value={ruleCategoryId}
                  onValueChange={setRuleCategoryId}
                >
                  <SelectTrigger>
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
              <Button
                size="sm"
                onClick={createRule}
                disabled={
                  !canCreateRule || pending || !ruleKeyword || !ruleCategoryId
                }
              >
                Tạo quy tắc
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={reclassify}
                onChange={(e) => setReclassify(e.target.checked)}
                disabled={!canCreateRule || pending}
              />
              Áp dụng ngay cho mọi dòng có tên khớp
            </label>
            {!canCreateRule && (
              <p className="text-xs text-muted-foreground">
                Chỉ quản trị viên có thể tạo quy tắc.
              </p>
            )}
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
            <TableHead className="text-right">Tổng</TableHead>
            <TableHead className="w-32">Trạng thái</TableHead>
            <TableHead className="w-44 text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <input
                  type="checkbox"
                  aria-label={`Chọn ${r.product_name_raw}`}
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
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
                <div className="truncate font-medium">{r.product_name_raw}</div>
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(r.quantity, 2)} {r.unit ?? ""}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatVND(r.total_amount)}
              </TableCell>
              <TableCell>
                <Badge variant="warning">Chưa phân loại</Badge>
              </TableCell>
              <TableCell className="text-right">
                {canCreateRule ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fillRuleFromRow(r)}
                  >
                    <Wand2 className="mr-1 h-3.5 w-3.5" />
                    Dùng tên này
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
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
    </div>
  );
}
