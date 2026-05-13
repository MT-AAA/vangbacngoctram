import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber, formatVND } from "@/lib/utils";
import type { InventoryDashboardSummary } from "@/lib/inventory/period-report";

export function InventorySummaryCards({
  summary,
}: {
  summary: InventoryDashboardSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <KpiCard label="Tổng TL tồn hiện có">
        <Big value={formatNumber(summary.totalCurrentWeight, 4)} suffix="chỉ" />
      </KpiCard>
      <KpiCard label="Tổng giá vốn tồn">
        <Big value={formatVND(summary.totalCurrentCost)} />
      </KpiCard>
      <KpiCard label="Giá vốn BQ toàn kho">
        <Big value={formatVND(summary.averageCost)} />
      </KpiCard>
      <KpiCard label="TL Vàng ta">
        <Big value={formatNumber(summary.byCode.vangta ?? summary.byCode.vang_ta ?? 0, 4)} suffix="chỉ" />
      </KpiCard>
      <KpiCard label="TL Vàng tây">
        <Big value={formatNumber(summary.byCode.vangtay ?? summary.byCode.vang_tay ?? 0, 4)} suffix="chỉ" />
      </KpiCard>
      <KpiCard label="TL Bạc">
        <Big value={formatNumber(summary.byCode.bac ?? 0, 4)} suffix="chỉ" />
      </KpiCard>
      <KpiCard label="Nhập trong kỳ" tone="success">
        <Big value={formatNumber(summary.periodInWeight, 4)} suffix="chỉ" />
      </KpiCard>
      <KpiCard label="Xuất trong kỳ" tone="warning">
        <Big value={formatNumber(summary.periodOutWeight, 4)} suffix="chỉ" />
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
  tone?: "warning" | "success";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300 bg-amber-50/60"
      : tone === "success"
        ? "border-emerald-300 bg-emerald-50/60"
        : undefined;
  return (
    <Card className={toneClass}>
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
