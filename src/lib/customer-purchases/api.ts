/**
 * Server helpers shared by `/api/customer-purchases/*` route handlers.
 *
 * Mirrors the pattern in `lib/issues/api.ts`: `requireMember` resolves the
 * caller's profile + store, returning a NextResponse on failure (so handlers
 * never need their own auth boilerplate). `writeAuditLog` is the single
 * chokepoint for emitting audit_log rows from this module so every mutation
 * leaves a trail.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

export type Role = Database["public"]["Enums"]["user_role"];
export type Profile = {
  id: string;
  store_id: string;
  role: Role;
};

export type RequireMemberSuccess = {
  ok: true;
  profile: Profile;
  authUserId: string;
};
export type RequireMemberFailure = { ok: false; response: NextResponse };

export async function requireMember(
  supabase: SupabaseClient<Database>,
  allowedRoles: ReadonlyArray<Role> = ["admin", "staff"]
): Promise<RequireMemberSuccess | RequireMemberFailure> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Bạn cần đăng nhập để tiếp tục." }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, store_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.store_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Tài khoản chưa được gán cửa hàng" },
        { status: 400 }
      ),
    };
  }

  if (!allowedRoles.includes(profile.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    profile: {
      id: profile.id,
      store_id: profile.store_id,
      role: profile.role,
    },
    authUserId: user.id,
  };
}

export type AuditLogInput = {
  store_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  diff?: Json;
  metadata?: Json;
};

export async function writeAuditLog(
  admin: SupabaseClient<Database>,
  input: AuditLogInput
): Promise<void> {
  await admin.from("audit_logs").insert({
    store_id: input.store_id,
    user_id: input.user_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    diff: input.diff ?? null,
    metadata: input.metadata ?? null,
  });
}
