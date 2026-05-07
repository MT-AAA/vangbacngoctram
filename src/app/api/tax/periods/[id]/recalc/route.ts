import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  recalculateTaxPeriod,
  cascadeRecalculateYear,
} from "@/lib/tax/recalculate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập để tiếp tục." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, store_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.store_id)
    return NextResponse.json({ error: "Tài khoản chưa được gán cửa hàng" }, { status: 400 });
  if (!["admin", "staff"].includes(profile.role))
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  try {
    const report = await recalculateTaxPeriod({
      storeId: profile.store_id,
      periodId: params.id,
      calculatedBy: profile.id,
    });
    await cascadeRecalculateYear({
      storeId: profile.store_id,
      fromPeriodId: params.id,
      calculatedBy: profile.id,
    });

    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      store_id: profile.store_id,
      user_id: profile.id,
      action: "recalculate_tax_period",
      entity_type: "tax_periods",
      entity_id: params.id,
    });

    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi" },
      { status: 500 }
    );
  }
}
