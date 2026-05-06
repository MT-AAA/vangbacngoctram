"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Calendar, ChevronDown } from "lucide-react";

export type PeriodKey = "day" | "month" | "quarter" | "year";

const ITEMS: Array<{ key: PeriodKey; label: string }> = [
  { key: "day", label: "Ngày" },
  { key: "month", label: "Tháng" },
  { key: "quarter", label: "Quý" },
  { key: "year", label: "Năm" },
];

export function PeriodFilter({
  active,
  rangeLabel,
}: {
  active: PeriodKey;
  rangeLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const setPeriod = (p: PeriodKey) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("period", p);
    start(() => router.push(`${pathname}?${sp.toString()}`));
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-pending={pending ? "true" : "false"}
    >
      <div className="card-cream rounded-xl p-1 flex">
        {ITEMS.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => setPeriod(it.key)}
            className={
              "px-4 h-9 rounded-lg text-sm font-medium transition-colors " +
              (active === it.key
                ? "bg-gold-gradient text-emerald-950 shadow"
                : "text-emerald-900/70 hover:bg-amber-300/20")
            }
          >
            {it.label}
          </button>
        ))}
      </div>
      <div className="card-cream rounded-xl px-3 h-10 flex items-center gap-2 text-sm text-emerald-900">
        <Calendar className="h-4 w-4 text-emerald-900/60" />
        <span className="font-medium">{rangeLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-emerald-900/40" />
      </div>
    </div>
  );
}
