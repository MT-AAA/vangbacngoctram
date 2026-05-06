"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Calendar, Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ReportPeriod } from "@/lib/reports/range";

type CategoryOption = { id: string; name: string };

type Props = {
  period: ReportPeriod;
  from: string;
  to: string;
  category?: string;
  showCategory?: boolean;
  categoryOptions?: CategoryOption[];
};

const PERIOD_ITEMS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "day", label: "Ngày" },
  { value: "month", label: "Tháng" },
  { value: "quarter", label: "Quý" },
  { value: "year", label: "Năm" },
  { value: "custom", label: "Tùy chọn" },
];

const CATEGORY_ALL = "__all__";
const CATEGORY_NONE = "__none__";

export function ReportFilterBar({
  period,
  from,
  to,
  category,
  showCategory,
  categoryOptions = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const submit = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    start(() => router.push(`${pathname}?${sp.toString()}`));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fromStr = String(fd.get("from") ?? from);
    const toStr = String(fd.get("to") ?? to);
    submit({ from: fromStr, to: toStr });
  };

  const categoryValue =
    !category || category === "all"
      ? CATEGORY_ALL
      : category === "none"
      ? CATEGORY_NONE
      : category;

  return (
    <form
      onSubmit={onSubmit}
      data-pending={pending ? "true" : "false"}
      className="report-filter-bar flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3"
    >
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">Kỳ</Label>
        <Select
          value={period}
          onValueChange={(v) => submit({ period: v as ReportPeriod })}
        >
          <SelectTrigger className="h-9 w-32">
            <Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_ITEMS.map((it) => (
              <SelectItem key={it.value} value={it.value}>
                {it.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground" htmlFor="rpt-from">
          Từ
        </Label>
        <Input
          id="rpt-from"
          name="from"
          type="date"
          defaultValue={from}
          className="h-9 w-40"
        />
      </div>

      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground" htmlFor="rpt-to">
          Đến
        </Label>
        <Input
          id="rpt-to"
          name="to"
          type="date"
          defaultValue={to}
          className="h-9 w-40"
        />
      </div>

      {showCategory && (
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Nhóm</Label>
          <Select
            value={categoryValue}
            onValueChange={(v) => {
              if (v === CATEGORY_ALL) submit({ category: undefined });
              else if (v === CATEGORY_NONE) submit({ category: "none" });
              else submit({ category: v });
            }}
          >
            <SelectTrigger className="h-9 w-44">
              <Tag className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CATEGORY_ALL}>Tất cả</SelectItem>
              <SelectItem value={CATEGORY_NONE}>Chưa phân loại</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" size="sm" variant="outline" className="h-9">
        Áp dụng
      </Button>
    </form>
  );
}
