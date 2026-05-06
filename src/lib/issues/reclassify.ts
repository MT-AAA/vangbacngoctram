/**
 * Run the classifier across the store, optionally limited to rows that
 * are still unclassified. Used by:
 *   * `/api/issues/sales/reclassify`
 *   * `/api/issues/rules/create` (when `reclassify=true`)
 *
 * Manually-classified rows (`classification_source = 'manual'`) with a
 * non-null category are NEVER overwritten by a re-run — that would
 * silently undo what an admin did. To force a manual override to be
 * re-evaluated, the admin can clear the category first via
 * `/issues/unclassified` after they reset it elsewhere.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  classifyProduct,
  type ClassificationRule,
} from "@/lib/classification";

type Admin = SupabaseClient<Database>;

export async function rerunClassification(
  admin: Admin,
  storeId: string,
  scope: "all" | "unclassified"
): Promise<number> {
  const { data: ruleRows } = await admin
    .from("classification_rules")
    .select("id, category_id, keyword, priority, is_active")
    .eq("store_id", storeId)
    .eq("is_active", true);

  const rules: ClassificationRule[] = (ruleRows ?? []).map((r) => ({
    id: r.id,
    category_id: r.category_id,
    keyword: r.keyword,
    priority: r.priority,
    is_active: r.is_active,
  }));

  const pageSize = 500;
  let page = 0;
  let updated = 0;

  while (true) {
    let query = admin
      .from("sales_transactions")
      .select("id, product_name_raw, product_category_id, classification_source")
      .eq("store_id", storeId);
    if (scope === "unclassified") {
      query = query.is("product_category_id", null);
    }
    query = query
      .order("id")
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data } = await query;
    const rows = data ?? [];
    if (rows.length === 0) break;

    const updates: Array<{
      id: string;
      product_category_id: string | null;
      classification_source: string;
    }> = [];

    for (const r of rows) {
      if (
        r.classification_source === "manual" &&
        r.product_category_id !== null
      ) {
        continue;
      }
      const cls = classifyProduct(r.product_name_raw, rules);
      if (cls.category_id !== r.product_category_id) {
        updates.push({
          id: r.id,
          product_category_id: cls.category_id,
          classification_source: cls.source,
        });
      }
    }

    for (const u of updates) {
      await admin
        .from("sales_transactions")
        .update({
          product_category_id: u.product_category_id,
          classification_source: u.classification_source,
        })
        .eq("id", u.id)
        .eq("store_id", storeId);
    }
    updated += updates.length;

    if (rows.length < pageSize) break;
    page += 1;
  }

  return updated;
}
