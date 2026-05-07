import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPeriod } from "@/lib/tax/period-utils";
import {
  recalculateTaxPeriod,
  cascadeRecalculateYear,
} from "@/lib/tax/recalculate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const periodType = body.period_type as "month" | "quarter" | "year" | "custom";
  if (!periodType)
    return NextResponse.json({ error: "Thiếu loại kỳ" }, { status: 400 });

  let p: { name: string; start_date: string; end_date: string; year: number };
  if (periodType === "custom") {
    if (!body.start_date || !body.end_date)
      return NextResponse.json(
        { error: "Kỳ tùy chỉnh cần ngày bắt đầu và kết thúc" },
        { status: 400 }
      );
    const start = new Date(body.start_date);
    p = {
      name: body.name ?? `Kỳ ${body.start_date} → ${body.end_date}`,
      start_date: body.start_date,
      end_date: body.end_date,
      year: start.getUTCFullYear(),
    };
  } else {
    p = buildPeriod(periodType, {
      year: body.year,
      month: body.month,
      quarter: body.quarter,
    });
  }

  const admin = createAdminClient();
  const { data: period, error } = await admin
    .from("tax_periods")
    .upsert(
      {
        store_id: profile.store_id,
        name: p.name,
        period_type: periodType,
        start_date: p.start_date,
        end_date: p.end_date,
        year: p.year,
      },
      { onConflict: "store_id,period_type,start_date,end_date" }
    )
    .select()
    .single();

  if (error || !period)
    return NextResponse.json(
      { error: error?.message ?? "Không tạo được kỳ" },
      { status: 500 }
    );

  // Calculate this period and cascade later periods in same year
  await recalculateTaxPeriod({
    storeId: profile.store_id,
    periodId: period.id,
    calculatedBy: profile.id,
  });
  await cascadeRecalculateYear({
    storeId: profile.store_id,
    fromPeriodId: period.id,
    calculatedBy: profile.id,
  });

  await admin.from("audit_logs").insert({
    store_id: profile.store_id,
    user_id: profile.id,
    action: "create_tax_period",
    entity_type: "tax_periods",
    entity_id: period.id,
    metadata: { period_type: periodType, name: p.name, year: p.year },
  });

  return NextResponse.json({ period });
}
