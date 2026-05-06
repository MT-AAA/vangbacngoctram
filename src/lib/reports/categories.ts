/**
 * Lookup helpers shared by reports that group / filter by product category.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DBClient = SupabaseClient<Database>;

export type CategoryOption = {
  id: string;
  code: string;
  name: string;
};

export async function loadCategoryOptions(
  client: DBClient
): Promise<CategoryOption[]> {
  const { data } = await client
    .from("product_categories")
    .select("id, code, name, display_order, is_active")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  return (data ?? [])
    .filter((c) => c.is_active !== false)
    .map((c) => ({ id: c.id, code: c.code, name: c.name }));
}

export const UNCLASSIFIED_LABEL = "Chưa phân loại";
