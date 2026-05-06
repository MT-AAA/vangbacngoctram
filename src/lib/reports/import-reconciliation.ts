/**
 * Report 10 — Import reconciliation.
 *
 * For each `import_files` row uploaded in [from,to], compares:
 *   - expected: `transaction_line_count` and `total_amount` from the import file
 *     (computed from the Excel during upload)
 *   - imported: `count(*)` and `sum(total_amount)` of `sales_transactions` rows
 *     with `import_file_id = file.id`
 *
 * Any non-zero delta is highlighted in the UI so users can investigate.
 *
 * The function does TWO queries: one for files, one for the aggregate (single
 * groupby on import_file_id, returned via Supabase RPC-free pattern: select all
 * sales_transactions with these import_file_ids and aggregate in JS).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

export type ImportReconRow = {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  expected_count: number;
  imported_count: number;
  expected_amount: number;
  imported_amount: number;
  inserted_rows: number;
  updated_rows: number;
  error_rows: number;
  delta_count: number;
  delta_amount: number;
};

export type ImportReconReport = {
  rows: ImportReconRow[];
  totals: {
    files: number;
    expected_count: number;
    imported_count: number;
    expected_amount: number;
    imported_amount: number;
    delta_count: number;
    delta_amount: number;
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

type FileRow = {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  transaction_line_count: number | null;
  unique_invoice_count: number | null;
  total_amount: number | null;
  inserted_rows: number | null;
  updated_rows: number | null;
  error_rows: number | null;
};

type SaleAgg = { import_file_id: string | null; total_amount: number | null };

export async function loadImportReconReport(
  client: DBClient,
  args: { from: string; to: string }
): Promise<ImportReconReport> {
  const { data: files } = await client
    .from("import_files")
    .select(
      "id, file_name, status, created_at, period_start, period_end, transaction_line_count, unique_invoice_count, total_amount, inserted_rows, updated_rows, error_rows"
    )
    .gte("created_at", `${args.from}T00:00:00.000Z`)
    .lte("created_at", `${args.to}T23:59:59.999Z`)
    .order("created_at", { ascending: false });

  const fileRows = (files ?? []) as FileRow[];
  if (fileRows.length === 0) {
    return {
      rows: [],
      totals: {
        files: 0,
        expected_count: 0,
        imported_count: 0,
        expected_amount: 0,
        imported_amount: 0,
        delta_count: 0,
        delta_amount: 0,
      },
    };
  }

  const ids = fileRows.map((f) => f.id);
  const { data: sales } = await client
    .from("sales_transactions")
    .select("import_file_id, total_amount")
    .in("import_file_id", ids);

  const byFile = new Map<string, { count: number; amount: number }>();
  for (const s of (sales ?? []) as SaleAgg[]) {
    if (!s.import_file_id) continue;
    const e = byFile.get(s.import_file_id) ?? { count: 0, amount: 0 };
    e.count += 1;
    e.amount = round2(e.amount + Number(s.total_amount ?? 0));
    byFile.set(s.import_file_id, e);
  }

  const rows: ImportReconRow[] = fileRows.map((f) => {
    const imported = byFile.get(f.id) ?? { count: 0, amount: 0 };
    const expected_count = Number(f.transaction_line_count ?? 0);
    const expected_amount = round2(Number(f.total_amount ?? 0));
    return {
      id: f.id,
      file_name: f.file_name,
      status: f.status,
      created_at: f.created_at,
      period_start: f.period_start,
      period_end: f.period_end,
      expected_count,
      imported_count: imported.count,
      expected_amount,
      imported_amount: imported.amount,
      inserted_rows: Number(f.inserted_rows ?? 0),
      updated_rows: Number(f.updated_rows ?? 0),
      error_rows: Number(f.error_rows ?? 0),
      delta_count: imported.count - expected_count,
      delta_amount: round2(imported.amount - expected_amount),
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.files += 1;
      acc.expected_count += r.expected_count;
      acc.imported_count += r.imported_count;
      acc.expected_amount = round2(acc.expected_amount + r.expected_amount);
      acc.imported_amount = round2(acc.imported_amount + r.imported_amount);
      acc.delta_count += r.delta_count;
      acc.delta_amount = round2(acc.delta_amount + r.delta_amount);
      return acc;
    },
    {
      files: 0,
      expected_count: 0,
      imported_count: 0,
      expected_amount: 0,
      imported_amount: 0,
      delta_count: 0,
      delta_amount: 0,
    }
  );

  return { rows, totals };
}
