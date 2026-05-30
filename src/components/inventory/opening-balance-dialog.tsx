"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoneyInput, parseVietnameseNumber } from "@/lib/utils";
import type { CategoryOption } from "./inventory-form";

type Props = {
  categories: CategoryOption[];
};

type DraftRow = {
  category_id: string;
  category_name: string;
  weight: string;
  cost: string;
};

type ExistingOpeningRow = {
  category_id: string;
  category_name?: string;
  category_code?: string;
  effective_date: string;
  weight: number;
  cost: number;
  unit_cost: number;
};

const TARGET_CATEGORY_NAMES = ["Bạc", "Vàng ta", "Vàng tây"];

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function OpeningBalanceDialog({ categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [effectiveDate, setEffectiveDate] = useState(todayIso());

  const initialRows = useMemo<DraftRow[]>(() => {
    return TARGET_CATEGORY_NAMES.map((name) => {
      const category = categories.find(
        (c) => c.name.trim().toLowerCase() === name.toLowerCase()
      );
      return {
        category_id: category?.id ?? "",
        category_name: name,
        weight: "",
        cost: "",
      };
    });
  }, [categories]);

  const [rows, setRows] = useState<DraftRow[]>(initialRows);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const loadExisting = async () => {
    setLoadingExisting(true);
    setRows(initialRows);
    try {
      const res = await fetch("/api/inventory/opening-balance", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Không tải được tồn đầu kỳ hiện có", {
          description: data?.error ?? `HTTP ${res.status}`,
        });
        return;
      }

      const existingRows = (data.rows ?? []) as ExistingOpeningRow[];
      if (existingRows[0]?.effective_date) {
        setEffectiveDate(existingRows[0].effective_date);
      }
      setRows(
        initialRows.map((row) => {
          const existing = existingRows.find((item) => item.category_id === row.category_id);
          if (!existing) return row;
          return {
            ...row,
            weight: String(existing.weight).replace(".", ","),
            cost: formatMoneyInput(String(Math.round(existing.cost))),
          };
        })
      );
    } finally {
      setLoadingExisting(false);
    }
  };

  const updateRow = (index: number, patch: Partial<DraftRow>) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const save = () => {
    const payloadRows = rows.map((row) => ({
      category_id: row.category_id,
      weight: parseVietnameseNumber(row.weight) ?? 0,
      cost: parseVietnameseNumber(row.cost) ?? 0,
    }));

    if (!effectiveDate) {
      toast.error("Vui lòng chọn mốc thời gian khởi tạo");
      return;
    }
    if (payloadRows.some((row) => !row.category_id)) {
      toast.error("Thiếu nhóm Bạc / Vàng ta / Vàng tây trong danh mục phân loại");
      return;
    }
    if (payloadRows.some((row) => row.weight < 0 || row.cost < 0)) {
      toast.error("TL tồn và giá vốn ban đầu không được âm");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/inventory/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effective_date: effectiveDate, rows: payloadRows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Lưu tồn đầu kỳ thất bại", {
          description: data?.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast.success(`Đã lưu ${data.saved_count ?? payloadRows.length} dòng tồn đầu kỳ`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOpen(true);
          void loadExisting();
        }}
      >
        Nhập / sửa tồn kho đầu kỳ
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nhập / sửa tồn kho đầu kỳ</DialogTitle>
            <DialogDescription>
              Đây là bộ dữ liệu tồn kho đầu kỳ duy nhất của hệ thống. Nếu đã khởi tạo,
              form sẽ hiện dữ liệu hiện có để chỉnh sửa; nếu chưa có thì nhập tồn
              cuối quý làm mốc bắt đầu tính cho các kỳ tiếp theo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-w-xs">
              <Label htmlFor="opening-effective-date">Mốc chốt tồn đầu kỳ</Label>
              <Input
                id="opening-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                disabled={pending || loadingExisting}
              />
            </div>

            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại sản phẩm tồn kho</TableHead>
                    <TableHead className="text-right">TL tồn ban đầu (chỉ)</TableHead>
                    <TableHead className="text-right">Giá vốn ban đầu (VND)</TableHead>
                    <TableHead className="text-right">Đơn giá bình quân</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.category_name}>
                      <TableCell className="font-medium">{row.category_name}</TableCell>
                      <TableCell>
                        <Input
                          className="text-right"
                          value={row.weight}
                          onChange={(e) => updateRow(index, { weight: e.target.value })}
                          placeholder="vd: 106"
                          disabled={pending || loadingExisting}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="text-right"
                          value={row.cost}
                          onChange={(e) =>
                            updateRow(index, { cost: formatMoneyInput(e.target.value) })
                          }
                          placeholder="vd: 1.745.470.239"
                          disabled={pending || loadingExisting}
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {(() => {
                          const weight = parseVietnameseNumber(row.weight) ?? 0;
                          const cost = parseVietnameseNumber(row.cost) ?? 0;
                          return weight > 0 ? formatMoneyInput(String(Math.round(cost / weight))) : "—";
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending || loadingExisting}>
              Huỷ
            </Button>
            <Button type="button" onClick={save} disabled={pending || loadingExisting}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Lưu tồn đầu kỳ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
