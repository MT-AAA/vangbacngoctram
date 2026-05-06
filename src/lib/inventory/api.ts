/**
 * Server helpers shared by all `/api/inventory/*` route handlers.
 *
 * Mirrors the structure of `src/lib/issues/api.ts`: a `requireMember`
 * gate that returns either resolved profile context or a NextResponse
 * error, plus a thin `writeAuditLog` helper. We re-export the latter from
 * the issues module so we don't have two copies to maintain.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

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

/**
 * Resolve the calling user, look up their profile + store_id and check
 * `allowedRoles`. Defaults to `['admin', 'staff']` since those are the only
 * roles that can mutate inventory.
 */
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
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
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

export { writeAuditLog } from "@/lib/issues/api";
