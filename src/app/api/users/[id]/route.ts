import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/issues/api";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = Database["public"]["Enums"]["user_role"];

const ALLOWED_ROLES: Role[] = ["admin", "staff", "viewer"];

/**
 * Update a user's role and / or active status. Admin-only and scoped to the
 * caller's store. Refuses to demote / deactivate the last remaining admin
 * unless the caller explicitly confirms (`confirm_remove_last_admin: true`).
 *
 * Body: { role?: Role, is_active?: boolean, confirm_remove_last_admin?: boolean }
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  const targetId = params.id;
  if (!targetId) {
    return NextResponse.json(
      { error: "Thiếu mã người dùng cần cập nhật." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const role = (body as { role?: unknown }).role;
  const isActive = (body as { is_active?: unknown }).is_active;
  const confirm = Boolean(
    (body as { confirm_remove_last_admin?: unknown }).confirm_remove_last_admin
  );

  if (role !== undefined && !ALLOWED_ROLES.includes(role as Role)) {
    return NextResponse.json(
      { error: "Vai trò không hợp lệ." },
      { status: 400 }
    );
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return NextResponse.json(
      { error: "Trạng thái không hợp lệ." },
      { status: 400 }
    );
  }
  if (role === undefined && isActive === undefined) {
    return NextResponse.json(
      { error: "Không có thay đổi nào để áp dụng." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, store_id, role, is_active, full_name, email, removed_at")
    .eq("id", targetId)
    .maybeSingle();

  if (!target || target.store_id !== auth.profile.store_id) {
    return NextResponse.json(
      { error: "Không tìm thấy người dùng trong cửa hàng của bạn." },
      { status: 404 }
    );
  }

  if (target.removed_at) {
    return NextResponse.json(
      { error: "Người dùng này đã bị gỡ khỏi cửa hàng." },
      { status: 409 }
    );
  }

  const newRole = (role as Role | undefined) ?? target.role;
  const newIsActive =
    typeof isActive === "boolean" ? isActive : target.is_active;

  const willRemoveAdmin =
    (target.role === "admin" && newRole !== "admin") ||
    (target.role === "admin" && target.is_active && !newIsActive);

  if (willRemoveAdmin) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("store_id", auth.profile.store_id)
      .eq("role", "admin")
      .eq("is_active", true);
    const activeAdminCount = count ?? 0;
    if (activeAdminCount <= 1 && !confirm) {
      return NextResponse.json(
        {
          error:
            "Đây là quản trị viên duy nhất đang hoạt động. Vui lòng xác nhận để tiếp tục.",
          code: "LAST_ADMIN_CONFIRMATION_REQUIRED",
        },
        { status: 409 }
      );
    }
  }

  const updates: { role?: Role; is_active?: boolean } = {};
  if (role !== undefined) updates.role = newRole;
  if (isActive !== undefined) updates.is_active = newIsActive;

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", targetId)
    .eq("store_id", auth.profile.store_id)
    .select("id, role, is_active, full_name, email")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Không cập nhật được người dùng. Vui lòng thử lại." },
      { status: 500 }
    );
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "user.update",
    entity_type: "profile",
    entity_id: targetId,
    diff: {
      before: {
        role: target.role,
        is_active: target.is_active,
      },
      after: {
        role: updated.role,
        is_active: updated.is_active,
      },
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}

/**
 * Soft-remove a user from the current store. Admin-only and scoped to the
 * caller's store. Sets `removed_at` + `removed_by` and forces `is_active=false`
 * but preserves the row so historical references (audit logs, sales rows,
 * import files, etc.) remain intact.
 *
 * Refuses to remove:
 *   - the caller themselves (self-remove)
 *   - the last active admin in the store
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  const targetId = params.id;
  if (!targetId) {
    return NextResponse.json(
      { error: "Thiếu mã người dùng cần gỡ." },
      { status: 400 }
    );
  }

  if (targetId === auth.profile.id) {
    return NextResponse.json(
      { error: "Bạn không thể gỡ chính mình." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, store_id, role, is_active, full_name, email, removed_at")
    .eq("id", targetId)
    .maybeSingle();

  if (!target || target.store_id !== auth.profile.store_id) {
    return NextResponse.json(
      { error: "Không tìm thấy người dùng trong cửa hàng của bạn." },
      { status: 404 }
    );
  }

  if (target.removed_at) {
    return NextResponse.json(
      { error: "Người dùng này đã bị gỡ khỏi cửa hàng." },
      { status: 409 }
    );
  }

  if (target.role === "admin" && target.is_active) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("store_id", auth.profile.store_id)
      .eq("role", "admin")
      .eq("is_active", true)
      .is("removed_at", null);
    const activeAdminCount = count ?? 0;
    if (activeAdminCount <= 1) {
      return NextResponse.json(
        {
          error: "Không thể gỡ quản trị viên duy nhất đang hoạt động.",
          code: "LAST_ADMIN_PROTECTED",
        },
        { status: 409 }
      );
    }
  }

  const removedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({
      removed_at: removedAt,
      removed_by: auth.profile.id,
      is_active: false,
    })
    .eq("id", targetId)
    .eq("store_id", auth.profile.store_id)
    .select("id, role, is_active, full_name, email, removed_at, removed_by")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Không thể gỡ người dùng. Vui lòng thử lại." },
      { status: 500 }
    );
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "remove_user_from_store",
    entity_type: "profile",
    entity_id: targetId,
    diff: {
      before: {
        role: target.role,
        is_active: target.is_active,
        removed_at: null,
      },
      after: {
        role: updated.role,
        is_active: updated.is_active,
        removed_at: updated.removed_at,
      },
    },
    metadata: {
      target_user_id: target.id,
      target_user_email: target.email,
      previous_role: target.role,
      previous_status: target.is_active ? "active" : "locked",
      removed_by_user_id: auth.profile.id,
      store_id: auth.profile.store_id,
      removed_at: removedAt,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}
