"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import type { PeriodKey } from "@/lib/dashboard/data";

const ITEMS: Array<{ key: Exclude<PeriodKey, "custom">; label: string }> = [
  { key: "day", label: "Ngày" },
  { key: "month", label: "Tháng" },
  { key: "quarter", label: "Quý" },
  { key: "year", label: "Năm" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthValue(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : todayISO().slice(0, 7);
}

function yearValue(date: string): string {
  return /^\d{4}-/.test(date) ? date.slice(0, 4) : String(new Date().getFullYear());
}

function quarterValue(date: string): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
  const month = Number(base.slice(5, 7));
  return String(Math.floor((month - 1) / 3) + 1);
}

function monthRange(value: string): { from: string; to: string } {
  const [year, month] = value.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

function quarterRange(year: string, quarter: string): { from: string; to: string } {
  const y = Number(year);
  const q = Number(quarter);
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const last = new Date(Date.UTC(y, endMonth, 0)).getUTCDate();
  return {
    from: `${y}-${pad(startMonth)}-01`,
    to: `${y}-${pad(endMonth)}-${pad(last)}`,
  };
}

function yearRange(year: string): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

type Props = {
  active: PeriodKey;
  from: string;
  to: string;
  rangeLabel: string;
};

export function InventoryPeriodFilter({ active, from, to, rangeLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const [day, setDay] = useState(from || todayISO());
  const [month, setMonth] = useState(monthValue(from));
  const [quarterYear, setQuarterYear] = useState(yearValue(from));
  const [quarter, setQuarter] = useState(quarterValue(from));
  const [year, setYear] = useState(yearValue(from));
  const [customFrom, setCustomFrom] = useState(from || "");
  const [customTo, setCustomTo] = useState(to || "");

  const editorLabel = useMemo(() => {
    if (active === "day") return "Chọn ngày";
    if (active === "month") return "Chọn tháng + năm";
    if (active === "quarter") return "Chọn quý + năm";
    if (active === "year") return "Chọn năm";
    return "Khoảng tùy chọn";
  }, [active]);

  const pushRange = (period: PeriodKey, range: { from: string; to: string }) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("period", period);
    sp.set("from", range.from);
    sp.set("to", range.to);
    start(() => {
      router.push(`${pathname}?${sp.toString()}`);
      setOpen(false);
    });
  };

  const setPeriod = (period: Exclude<PeriodKey, "custom">) => {
    if (period === "day") pushRange("day", { from: day, to: day });
    if (period === "month") pushRange("month", monthRange(month));
    if (period === "quarter") pushRange("quarter", quarterRange(quarterYear, quarter));
    if (period === "year") pushRange("year", yearRange(year));
  };

  const apply = () => {
    if (active === "day") return pushRange("day", { from: day, to: day });
    if (active === "month") return pushRange("month", monthRange(month));
    if (active === "quarter") return pushRange("quarter", quarterRange(quarterYear, quarter));
    if (active === "year") return pushRange("year", yearRange(year));
    if (customFrom && customTo) return pushRange("custom", { from: customFrom, to: customTo });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3" data-pending={pending ? "true" : "false"}>
      <div className="card-cream rounded-xl p-1 flex flex-wrap">
        {ITEMS.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => setPeriod(it.key)}
            className={
              "px-3 sm:px-4 h-9 rounded-lg text-sm font-medium transition-colors " +
              (active === it.key
                ? "bg-gold-gradient text-emerald-950 shadow"
                : "text-emerald-900/70 hover:bg-amber-300/20")
            }
          >
            {it.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const sp = new URLSearchParams(searchParams.toString());
            sp.set("period", "custom");
            start(() => router.push(`${pathname}?${sp.toString()}`));
            setOpen(true);
          }}
          className={
            "px-3 sm:px-4 h-9 rounded-lg text-sm font-medium transition-colors " +
            (active === "custom"
              ? "bg-gold-gradient text-emerald-950 shadow"
              : "text-emerald-900/70 hover:bg-amber-300/20")
          }
        >
          Tùy chọn
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="card-cream rounded-xl px-3 h-10 flex items-center gap-2 text-sm text-emerald-900 hover:bg-amber-300/15"
        >
          <span className="font-medium">{rangeLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-emerald-900/40" />
        </button>

        {open ? (
          <div className="absolute right-0 z-30 mt-2 w-[min(92vw,340px)] card-cream rounded-2xl p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-forest">{editorLabel}</div>
              <button type="button" onClick={() => setOpen(false)} className="h-7 w-7 rounded-md hover:bg-amber-300/20 flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            {active === "day" ? (
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-full h-10 rounded-lg border border-amber-300/60 bg-white/80 px-3 text-sm" />
            ) : null}

            {active === "month" ? (
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full h-10 rounded-lg border border-amber-300/60 bg-white/80 px-3 text-sm" />
            ) : null}

            {active === "quarter" ? (
              <div className="grid grid-cols-2 gap-2">
                <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="h-10 rounded-lg border border-amber-300/60 bg-white/80 px-3 text-sm">
                  <option value="1">Quý 1</option>
                  <option value="2">Quý 2</option>
                  <option value="3">Quý 3</option>
                  <option value="4">Quý 4</option>
                </select>
                <input type="number" value={quarterYear} onChange={(e) => setQuarterYear(e.target.value)} className="h-10 rounded-lg border border-amber-300/60 bg-white/80 px-3 text-sm" />
              </div>
            ) : null}

            {active === "year" ? (
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-full h-10 rounded-lg border border-amber-300/60 bg-white/80 px-3 text-sm" />
            ) : null}

            {active === "custom" ? (
              <div className="grid gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full h-10 rounded-lg border border-amber-300/60 bg-white/80 px-3 text-sm" />
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full h-10 rounded-lg border border-amber-300/60 bg-white/80 px-3 text-sm" />
              </div>
            ) : null}

            <button type="button" onClick={apply} disabled={pending} className="mt-3 w-full h-10 rounded-lg bg-gold-gradient text-emerald-950 text-sm font-semibold shadow disabled:opacity-60">
              Áp dụng
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
