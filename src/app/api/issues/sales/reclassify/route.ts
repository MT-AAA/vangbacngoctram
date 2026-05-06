import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/issues/api";
import { rerunClassification } from "@/lib/issues/reclassify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-run classification across the store. Admin-only because it can
 * change category assignments on existing rows.
 *
 * Body: { scope: 'all' | 'unclassified' }   (default 'unclassified')
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const scopeRaw = (body as { scope?: unknown }).scope;
  const scope: "all" | "unclassified" = scopeRaw === "all" ? "all" : "unclassified";

  const admin = createAdminClient();
  const reclassified = await rerunClassification(
    admin,
    auth.profile.store_id,
    scope
  );

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "classification_rerun",
    entity_type: "sales_transactions",
    metadata: { scope, reclassified },
  });

  return NextResponse.json({ reclassified, scope });
}
