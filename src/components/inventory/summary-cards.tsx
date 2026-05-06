import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber, formatVND } from "@/lib/utils";
import type { InventorySummary } from "@/lib/inventory/queries";

export function InventorySummaryCards({
  summary,
}: {
  summary: InventorySummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <KpiCard label="Tổng món tồn">
        <Big value={summary.totalItems.toLocaleString("vi-VN")} suffix="món" />
      </KpiCard>
      <KpiCard label="Tổng giá mua tồn kho">
        <Big value={formatVND(summary.totalPurchaseCost)} />
      </KpiCard>
      <KpiCard label="TL Vàng ta">
        <Big value={formatNumber(summary.weightVangTa, 4)} suffix="chỉ" />
      </KpiCard>
      <KpiCard label="TL Vàng tây">
        <Big value={formatNumber(summary.weightVangTay, 4)} suffix="chỉ" />
      </KpiCard>
      <KpiCard label="TL Bạc">
        <Big value={formatNumber(summary.weightBac, 4)} suffix="chỉ" />
      </KpiCard>
      <KpiCard label="Hàng thiếu giá mua" tone="warning">
        <Big
          value={summary.missingCostCount.toLocaleString("vi-VN")}
          suffix="món"
        />
      </KpiCard>
      <KpiCard label="Hàng tồn thấp" tone="warning">
        <Big
          value={summary.lowStockCount.toLocaleString("vi-VN")}
          suffix="món"
        />
      </KpiCard>
    </div>
  );
}

function KpiCard({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "warning";
  children: React.ReactNode;
}) {
  return (
    <Card className={tone === "warning" ? "border-amber-300" : undefined}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Big({ value, suffix }: { value: string; suffix?: string }) {
  return (
    <CardTitle className="text-xl font-bold">
      {value}
      {suffix ? (
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </CardTitle>
  );
}
