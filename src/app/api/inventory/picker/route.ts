import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/inventory/api";
import { loadInventoryPicker } from "@/lib/inventory/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/inventory/picker?category_id=...&q=...
 *
 * Returns inventory rows that can be linked to a sales transaction. The
 * front-end uses this for the "Gắn với tồn kho" picker.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin", "staff"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category_id");
  const q = url.searchParams.get("q");

  const rows = await loadInventoryPicker(supabase, {
    categoryId,
    nameLike: q,
  });

  return NextResponse.json({ items: rows });
}
