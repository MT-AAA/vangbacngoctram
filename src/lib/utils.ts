import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const NUM_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function formatVND(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return VND_FORMATTER.format(value);
}

export function formatNumber(
  value: number | null | undefined,
  fractionDigits = 2
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatVNDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Render a JS `number` for use as the `value` of a controlled text input on
 * the Vietnamese-locale forms. Produces `"1,5"` / `"4200000"` (NO thousands
 * separators — which would visually conflict with the user typing) so the
 * string round-trips losslessly through {@link parseVietnameseNumber}.
 *
 * Without this helper, `String(1.5) === "1.5"`; the parser then treats the
 * `.` as a thousands separator and silently produces `15`, inflating any
 * decimal value 10× on edit.
 */
export function formatNumberForInput(
  value: number,
  maxFractionDigits = 4
): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  }).format(value);
}

export function formatMoneyInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

export function parseVietnameseNumber(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const trimmed = input.toString().trim();
  if (!trimmed) return null;
  // Remove currency symbols and spaces
  const cleaned = trimmed
    .replace(/[₫đVNDvnd\s]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export { NUM_FORMATTER, VND_FORMATTER };
