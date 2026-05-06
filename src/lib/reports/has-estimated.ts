/**
 * Quick "does this range contain estimated rows?" probe shared by every
 * report that aggregates `sales_transactions`. Single COUNT query so the
 * shell can render the warning banner without re-fetching the underlying
 * rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

export type EstimatedSummary = {
  has_estimated: boolean;
  estimated_count: number;
};

export async function loadEstimatedSummary(
  client: DBClient,
  args: { from: string; to: string }
): Promise<EstimatedSummary> {
  const { count } = await client
    .from("sales_transactions")
    .select("id", { count: "exact", head: true })
    .eq("tax_calculation_status", "estimated")
    .gte("sale_date", args.from)
    .lte("sale_date", args.to);

  const n = count ?? 0;
  return { has_estimated: n > 0, estimated_count: n };
}
