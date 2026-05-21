import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/customer-purchases/api";
import { listCustomerPurchases } from "@/lib/customer-purchases/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin", "staff", "viewer"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const { rows } = await listCustomerPurchases(supabase, {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    customer: url.searchParams.get("customer") ?? undefined,
    taxInput: url.searchParams.get("tax_input") ?? undefined,
    page: 1,
    pageSize: 10000,
  });

  return NextResponse.json({ rows });
}
