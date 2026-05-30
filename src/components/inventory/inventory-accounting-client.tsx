"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InventoryPeriodFilter } from "@/components/inventory/inventory-period-filter";
import { categoryBadgeClassName } from "@/components/product-category-badge";
import { formatNumber, formatVND } from "@/lib/utils";
import type {
  InventoryDetailGroup,
  InventoryPeriodReport,
} from "@/lib/inventory/period-report";
import type { PeriodKey } from "@/lib/dashboard/data";
import { OpeningBalanceDialog } from "./opening-balance-dialog";
import type { CategoryOption } from "./inventory-form";

type Props = {
  report: InventoryPeriodReport;
  categories: CategoryOption[];
  filters: {
    period: PeriodKey;
    category: string;
    from: string;
    to: string;
    rangeLabel: string;
  };
};

export function InventoryAccountingClient({ report, categories, filters }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <InventoryPeriodFilter
          active={filters.period}
          from={filters.from}
          to={filters.to}
          rangeLabel={filters.rangeLabel}
        />
        <OpeningBalanceDialog categories={categories} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên loại tồn kho</TableHead>
              <TableHead>Nhóm</TableHead>
              <TableHead className="text-right">TL tồn ban đầu</TableHead>
              <TableHead className="text-right">TL nhập kỳ</TableHead>
              <TableHead className="text-right">TL xuất kỳ</TableHead>
              <TableHead className="text-right">TL tồn hiện có</TableHead>
              <TableHead className="text-right">Giá vốn</TableHead>
              <TableHead className="text-right">Giá vốn BQ</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow key={row.category_id} className="hover:bg-amber-50/50">
                <TableCell className="font-semibold">Tồn kho bình quân - {row.category_name}</TableCell>
                <TableCell><Badge className={categoryBadgeClassName(row.category_name)}>{row.category_name}</Badge></TableCell>
                <TableCell className="text-right">{formatNumber(row.opening_weight, 4)} chỉ</TableCell>
                <TableCell className="text-right text-emerald-700">+{formatNumber(row.period_in_weight, 4)} chỉ</TableCell>
                <TableCell className="text-right text-rose-700">-{formatNumber(row.period_out_weight, 4)} chỉ</TableCell>
                <TableCell className="text-right font-semibold">{formatNumber(row.current_weight, 4)} chỉ</TableCell>
                <TableCell className="text-right">{formatVND(row.current_cost)}</TableCell>
                <TableCell className="text-right">{formatVND(row.average_cost)}</TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {report.detailGroups.map((group) => <DetailGroup key={group.key} group={group} />)}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "low" | "negative" }) {
  if (status === "negative") return <Badge variant="destructive">Âm tồn</Badge>;
  if (status === "low") return <Badge variant="warning">Tồn thấp</Badge>;
  return <Badge variant="success">Ổn định</Badge>;
}

function DetailGroup({ group }: { group: InventoryDetailGroup }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{group.label}</h3>
          <p className="text-xs text-muted-foreground">
            {formatNumber(group.total_weight, 4)} chỉ · {formatVND(group.total_cost)}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {group.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có phát sinh.</p>
        ) : group.rows.slice(0, 8).map((row) => (
          <div key={row.id} className="rounded-xl bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{row.label}</span>
              <span className="text-xs text-muted-foreground">{row.date}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{formatNumber(row.weight, 4)} chỉ</span>
              <span>{formatVND(row.cost)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

