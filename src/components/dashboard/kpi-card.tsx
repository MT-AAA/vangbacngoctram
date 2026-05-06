import { ArrowDown, ArrowUp } from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Percentage change vs previous period; positive = up, negative = down. null = unknown. */
  changePct?: number | null;
  /** Whether "up" is good (default) or bad (e.g. for "negative carry-forward" we want it down). */
  upIsGood?: boolean;
  /** Optional override for value text color (e.g. forest, default gold). */
  valueColorClass?: string;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  changePct,
  upIsGood = true,
  valueColorClass = "text-gold",
}: KpiCardProps) {
  const hasChange = typeof changePct === "number" && Number.isFinite(changePct);
  const up = hasChange ? changePct! >= 0 : null;
  const isGood = up === null ? null : (up && upIsGood) || (!up && !upIsGood);

  return (
    <div className="card-cream rounded-2xl p-4 lg:p-5 flex items-center gap-4">
      <div className="icon-rim h-14 w-14 rounded-full flex items-center justify-center shrink-0">
        <Icon className="h-6 w-6 text-amber-700" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-emerald-900/65 truncate">{label}</div>
        <div
          className={cn(
            "mt-1 text-xl lg:text-2xl font-bold truncate",
            valueColorClass
          )}
          title={value}
        >
          {value}
        </div>
        {hasChange ? (
          <div
            className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              isGood ? "text-emerald-700" : "text-rose-600"
            )}
          >
            {up ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            <span className="font-semibold">
              {Math.abs(changePct!).toFixed(1)}%
            </span>
            <span className="text-emerald-900/55 font-normal">
              so với kỳ trước
            </span>
          </div>
        ) : (
          <div className="mt-1 text-[11px] text-emerald-900/40">
            Không có dữ liệu kỳ trước
          </div>
        )}
      </div>
    </div>
  );
}
