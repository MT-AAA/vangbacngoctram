/**
 * Minimal CSV serialiser shared by every `/api/reports/<slug>/csv` route.
 *
 * - Output is UTF-8 with BOM so Excel on Windows opens Vietnamese diacritics
 *   correctly without a manual import.
 * - Fields are double-quoted and inner quotes escaped (`"` → `""`).
 * - Numbers are passed through verbatim — callers should pre-format with the
 *   locale they want (`vi-VN`) so the CSV rounds + groups consistently with
 *   the on-page table.
 * - `prefixLines` lets callers prepend non-column rows (e.g. a warning line
 *   when the report contains estimated data). They are emitted as raw lines
 *   ABOVE the header row, prefixed with `# ` by convention so spreadsheet
 *   apps treat them as comments.
 */

export type CsvColumn = {
  key: string;
  header: string;
};

export type CsvOptions = {
  prefixLines?: string[];
};

const BOM = "\ufeff";

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else if (typeof value === "number") {
    s = Number.isFinite(value) ? String(value) : "";
  } else if (typeof value === "boolean") {
    s = value ? "true" : "false";
  } else {
    s = String(value);
  }
  if (s === "") return "";
  // Always quote — robust against embedded commas, semicolons, line breaks,
  // and Excel's bizarre handling of leading whitespace.
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns: ReadonlyArray<CsvColumn>,
  options: CsvOptions = {}
): string {
  const lines: string[] = [];
  for (const prefix of options.prefixLines ?? []) {
    lines.push(prefix);
  }
  lines.push(columns.map((c) => csvEscape(c.header)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c.key])).join(","));
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

export function csvHeaders(filename: string): Record<string, string> {
  const safe = filename.replace(/[^A-Za-z0-9_.\-]+/g, "_");
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${safe}"`,
    "Cache-Control": "no-store",
  };
}
