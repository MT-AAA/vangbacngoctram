import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập để tiếp tục." },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, store_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.store_id) {
    return NextResponse.json(
      { error: "Tài khoản chưa được gán cửa hàng" },
      { status: 400 }
    );
  }

  if (!["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: period } = await admin
    .from("tax_periods")
    .select("id, name, is_locked")
    .eq("store_id", profile.store_id)
    .eq("id", params.id)
    .maybeSingle();

  if (!period) {
    return NextResponse.json({ error: "Không tìm thấy kỳ thuế" }, { status: 404 });
  }

  if (period.is_locked) {
    return NextResponse.json(
      { error: "Kỳ thuế đã khóa, không thể xóa" },
      { status: 409 }
    );
  }

  await admin
    .from("tax_reports")
    .delete()
    .eq("store_id", profile.store_id)
    .eq("tax_period_id", period.id);

  const { error } = await admin
    .from("tax_periods")
    .delete()
    .eq("store_id", profile.store_id)
    .eq("id", period.id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Không xóa được kỳ thuế" },
      { status: 500 }
    );
  }

  await admin.from("audit_logs").insert({
    store_id: profile.store_id,
    user_id: profile.id,
    action: "delete_tax_period",
    entity_type: "tax_periods",
    entity_id: period.id,
    metadata: { name: period.name },
  });

  return NextResponse.json({ ok: true });
}
