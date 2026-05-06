/**
 * Server-side data layer for the "Cần xử lý" data quality screen (`/issues`).
 *
 * The 6 issue groups exposed here come straight from the Phase 2B spec:
 *
 *   1. missingCost   — sales rows where purchase_cost_amount is null and the
 *                      row hasn't been intentionally ignored.
 *   2. unclassified  — sales rows where product_category_id is null.
 *   3. estimated     — sales rows where tax_calculation_status = 'estimated'
 *                      (i.e. cost was averaged in, not real).
 *   4. negativeVAT   — tax_reports with negative_carried_out > 0.
 *   5. reconciliation — import_files where the committed row counts diverge
 *                      from the parsed counts (or error_rows > 0).
 *   6. duplicates    — same invoice/product line appearing more than once
 *                      OR the same invoice_no spread across multiple invoice
 *                      keys (= different series).
 *
 * Counts are intentionally cheap (HEAD selects with `count: 'exact'`) so the
 * `/issues` index loads fast even on large stores. The list pages do their
 * own paginated fetches via `queries.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { findDuplicateGroups, findReconciliationWarnings } from "./queries";

export type IssueCounts = {
  missingCost: number;
  unclassified: number;
  estimated: number;
  ignored: number;
  negativeVAT: number;
  reconciliationWarnings: number;
  duplicates: number;
  total: number;
};

type DBClient = SupabaseClient<Database>;

export async function loadIssueCounts(client?: DBClient): Promise<IssueCounts> {
  const supabase = client ?? createClient();

  const [
    missingCostRes,
    unclassifiedRes,
    estimatedRes,
    ignoredRes,
    negativeVATRes,
  ] = await Promise.all([
    supabase
      .from("sales_transactions")
      .select("id", { count: "exact", head: true })
      .eq("tax_calculation_status", "missing_purchase_cost")
      .eq("is_intentionally_ignored", false),
    supabase
      .from("sales_transactions")
      .select("id", { count: "exact", head: true })
      .is("product_category_id", null),
    supabase
      .from("sales_transactions")
      .select("id", { count: "exact", head: true })
      .eq("tax_calculation_status", "estimated"),
    supabase
      .from("sales_transactions")
      .select("id", { count: "exact", head: true })
      .eq("is_intentionally_ignored", true),
    supabase
      .from("tax_reports")
      .select("id", { count: "exact", head: true })
      .gt("negative_carried_out", 0),
  ]);

  const [reconciliationRows, duplicateGroups] = await Promise.all([
    findReconciliationWarnings(supabase, { onlyCount: true }),
    findDuplicateGroups(supabase, { onlyCount: true }),
  ]);

  const missingCost = missingCostRes.count ?? 0;
  const unclassified = unclassifiedRes.count ?? 0;
  const estimated = estimatedRes.count ?? 0;
  const ignored = ignoredRes.count ?? 0;
  const negativeVAT = negativeVATRes.count ?? 0;
  const reconciliationWarnings = reconciliationRows.count;
  const duplicates = duplicateGroups.count;

  return {
    missingCost,
    unclassified,
    estimated,
    ignored,
    negativeVAT,
    reconciliationWarnings,
    duplicates,
    total:
      missingCost +
      unclassified +
      estimated +
      negativeVAT +
      reconciliationWarnings +
      duplicates,
  };
}
