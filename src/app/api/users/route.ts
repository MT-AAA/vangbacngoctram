import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/issues/api";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = Database["public"]["Enums"]["user_role"];

const ALLOWED_ROLES: Role[] = ["staff", "viewer"];

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const fullName = asText((body as { full_name?: unknown }).full_name);
  const email = asText((body as { email?: unknown }).email).toLowerCase();
  const password = asText((body as { password?: unknown }).password);
  const role = (body as { role?: unknown }).role as Role;

  if (!fullName) {
    return NextResponse.json({ error: "Vui lòng nhập họ tên." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Mật khẩu phải có ít nhất 4 ký tự." }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Chỉ được tạo tài khoản quyền xem hoặc chỉnh sửa." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Không tạo được tài khoản." },
      { status: 500 }
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .update({
      store_id: auth.profile.store_id,
      role,
      full_name: fullName,
      email,
      is_active: true,
      removed_at: null,
      removed_by: null,
    })
    .eq("id", created.user.id)
    .select("id, full_name, email, role, is_active, created_at, removed_at")
    .maybeSingle();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "Không gán được tài khoản vào cửa hàng." },
      { status: 500 }
    );
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "user.create",
    entity_type: "profile",
    entity_id: profile.id,
    diff: {
      after: {
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        is_active: profile.is_active,
      },
    },
  });

  return NextResponse.json({ ok: true, user: profile });
}
