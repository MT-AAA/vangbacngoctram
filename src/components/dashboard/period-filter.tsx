"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";

export type PeriodKey = "day" | "month" | "quarter" | "year" | "custom";

const ITEMS: Array<{ key: Exclude<PeriodKey, "custom">; label: string }> = [
  { key: "day", label: "Ngày" },
  { key: "month", label: "Tháng" },
  { key: "quarter", label: "Quý" },
  { key: "year", label: "Năm" },
];

export function PeriodFilter({
  active,
  rangeLabel,
  customFrom,
  customTo,
}: {
  active: PeriodKey;
  rangeLabel: string;
  customFrom?: string;
  customTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(customFrom ?? "");
  const [to, setTo] = useState(customTo ?? "");
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Reset local fields when URL props change.
  useEffect(() => {
    setFrom(customFrom ?? "");
    setTo(customTo ?? "");
  }, [customFrom, customTo]);

  // Close popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setPeriod = (p: Exclude<PeriodKey, "custom">) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("period", p);
    sp.delete("from");
    sp.delete("to");
    start(() => router.push(`${pathname}?${sp.toString()}`));
  };

  const applyCustom = () => {
    if (!from || !to) {
      setError("Vui lòng chọn cả ngày bắt đầu và ngày kết thúc.");
      return;
    }
    if (from > to) {
      setError("Khoảng ngày không hợp lệ");
      return;
    }
    setError(null);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("period", "custom");
    sp.set("from", from);
    sp.set("to", to);
    start(() => {
      router.push(`${pathname}?${sp.toString()}`);
      setOpen(false);
    });
  };

  const resetCustom = () => {
    setFrom("");
    setTo("");
    setError(null);
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("from");
    sp.delete("to");
    sp.set("period", "month");
    start(() => {
      router.push(`${pathname}?${sp.toString()}`);
      setOpen(false);
    });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 sm:gap-3"
      data-pending={pending ? "true" : "false"}
    >
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
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
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

      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="card-cream rounded-xl px-3 h-10 flex items-center gap-2 text-sm text-emerald-900 hover:bg-amber-300/15"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Calendar className="h-4 w-4 text-emerald-900/60" />
          <span className="font-medium">{rangeLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-emerald-900/40" />
        </button>

        {open ? (
          <div
            role="dialog"
            aria-label="Chọn khoảng thời gian"
            className="absolute right-0 sm:right-0 left-auto z-30 mt-2 w-[min(92vw,320px)] card-cream rounded-2xl p-4 shadow-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-forest">
                Khoảng tùy chọn
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="h-7 w-7 rounded-md hover:bg-amber-300/20 flex items-center justify-center text-emerald-900/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-emerald-900/70 mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setError(null);
                  }}
                  className="w-full h-10 rounded-lg border border-amber-300/60 bg-white/80 px-3 text-sm text-emerald-950 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-900/70 mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setError(null);
                  }}
                  className="w-full h-10 rounded-lg border border-amber-300/60 bg-white/80 px-3 text-sm text-emerald-950 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                />
              </div>
              {error ? (
                <p className="text-xs text-rose-700">{error}</p>
              ) : null}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={pending}
                  className="flex-1 h-10 rounded-lg bg-gold-gradient text-emerald-950 text-sm font-semibold shadow disabled:opacity-60"
                >
                  Áp dụng
                </button>
                <button
                  type="button"
                  onClick={resetCustom}
                  disabled={pending}
                  className="h-10 px-3 rounded-lg border border-amber-300/60 text-sm text-emerald-900 hover:bg-amber-300/15 disabled:opacity-60"
                >
                  Đặt lại
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
