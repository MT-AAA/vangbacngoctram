import type { Database } from "@/lib/supabase/database.types";

export type PeriodType = Database["public"]["Enums"]["tax_period_type"];

export function buildPeriod(
  type: PeriodType,
  ref: { year: number; month?: number; quarter?: number }
): { name: string; start_date: string; end_date: string; year: number } {
  const { year } = ref;
  switch (type) {
    case "month": {
      const month = ref.month ?? 1;
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      return {
        name: `Tháng ${String(month).padStart(2, "0")}/${year}`,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        year,
      };
    }
    case "quarter": {
      const q = ref.quarter ?? 1;
      const startMonth = (q - 1) * 3;
      const start = new Date(Date.UTC(year, startMonth, 1));
      const end = new Date(Date.UTC(year, startMonth + 3, 0));
      return {
        name: `Quý ${q}/${year}`,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        year,
      };
    }
    case "year": {
      return {
        name: `Năm ${year}`,
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        year,
      };
    }
    case "custom":
    default:
      throw new Error("Custom period must be built explicitly with start/end dates.");
  }
}

export function describePeriod(p: {
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  name: string;
}): string {
  return p.name;
}
