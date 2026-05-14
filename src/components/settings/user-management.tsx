"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck, UserCog, UserMinus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatVNDate } from "@/lib/utils";
import { roleLabel } from "@/components/app-shell/nav-items";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["user_role"];

type Filter = "active" | "locked" | "removed" | "all";

const ROLE_OPTIONS: Array<{ value: Role; label: string; description: string }> = [
  {
    value: "admin",
    label: "Quản trị viên",
    description: "Toàn quyền quản lý hệ thống, dữ liệu, người dùng và cài đặt.",
  },
  {
    value: "staff",
    label: "Nhân viên",
    description: "Nhập liệu, bán hàng, cập nhật tồn kho và xử lý các mục cần xử lý.",
  },
  {
    value: "viewer",
    label: "Người xem",
    description: "Chỉ xem báo cáo và dữ liệu, không chỉnh sửa.",
  },
];

const FILTER_TABS: Array<{ value: Filter; label: string }> = [
  { value: "active", label: "Đang hoạt động" },
  { value: "locked", label: "Tạm khóa" },
  { value: "removed", label: "Đã gỡ" },
  { value: "all", label: "Tất cả" },
];

export type SettingsUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  removed_at: string | null;
};

type PendingAction =
  | {
      type: "role";
      user: SettingsUser;
      newRole: Role;
    }
  | {
      type: "active";
      user: SettingsUser;
      newActive: boolean;
    }
  | {
      type: "remove";
      user: SettingsUser;
    };

function userStatus(u: SettingsUser): "active" | "locked" | "removed" {
  if (u.removed_at) return "removed";
  return u.is_active ? "active" : "locked";
}

function statusBadge(u: SettingsUser) {
  const s = userStatus(u);
  if (s === "removed") {
    return <Badge variant="destructive">Đã gỡ</Badge>;
  }
  if (s === "locked") {
    return <Badge variant="secondary">Tạm khóa</Badge>;
  }
  return <Badge variant="success">Đang hoạt động</Badge>;
}

export function UserManagement({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: SettingsUser[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "viewer" as Role,
  });

  const activeAdminCount = useMemo(
    () =>
      users.filter(
        (u) => u.role === "admin" && u.is_active && !u.removed_at
      ).length,
    [users]
  );

  const visibleUsers = useMemo(() => {
    return users.filter((u) => {
      const s = userStatus(u);
      if (filter === "all") return true;
      return s === filter;
    });
  }, [users, filter]);

  const callPatch = async (
    userId: string,
    body: Record<string, unknown>
  ): Promise<{ ok: true } | { ok: false; needsConfirm?: boolean; error: string }> => {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    let payload: { error?: string; code?: string } = {};
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    return {
      ok: false,
      needsConfirm: payload.code === "LAST_ADMIN_CONFIRMATION_REQUIRED",
      error: payload.error ?? "Có lỗi xảy ra. Vui lòng thử lại.",
    };
  };

  const callDelete = async (
    userId: string
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (res.ok) return { ok: true };
    let payload: { error?: string } = {};
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    return {
      ok: false,
      error: payload.error ?? "Không thể gỡ người dùng. Vui lòng thử lại.",
    };
  };

  const applyRoleChange = async (user: SettingsUser, newRole: Role, confirmFlag = false) => {
    setSubmitting(user.id);
    try {
      const res = await callPatch(user.id, {
        role: newRole,
        confirm_remove_last_admin: confirmFlag,
      });
      if (!res.ok) {
        if (res.needsConfirm) {
          setConfirm({ type: "role", user, newRole });
          return;
        }
        toast.error(res.error);
        return;
      }
      toast.success(
        `Đã cập nhật vai trò của ${user.full_name ?? user.email} thành ${roleLabel(
          newRole
        )}.`
      );
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  };

  const applyActiveChange = async (
    user: SettingsUser,
    newActive: boolean,
    confirmFlag = false
  ) => {
    setSubmitting(user.id);
    try {
      const res = await callPatch(user.id, {
        is_active: newActive,
        confirm_remove_last_admin: confirmFlag,
      });
      if (!res.ok) {
        if (res.needsConfirm) {
          setConfirm({ type: "active", user, newActive });
          return;
        }
        toast.error(res.error);
        return;
      }
      toast.success(
        newActive
          ? `Đã kích hoạt ${user.full_name ?? user.email}.`
          : `Đã tạm khóa ${user.full_name ?? user.email}.`
      );
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  };

  const applyRemove = async (user: SettingsUser) => {
    setSubmitting(user.id);
    try {
      const res = await callDelete(user.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Đã gỡ người dùng khỏi cửa hàng.");
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const payload: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Không tạo được tài khoản.");
        return;
      }
      toast.success("Đã tạo tài khoản mới.");
      setNewUser({ full_name: "", email: "", password: "", role: "viewer" });
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const removeDisabledReason = (user: SettingsUser): string | null => {
    if (user.removed_at) return "Người dùng đã bị gỡ khỏi cửa hàng.";
    if (user.id === currentUserId) return "Bạn không thể gỡ chính mình.";
    if (
      user.role === "admin" &&
      user.is_active &&
      activeAdminCount <= 1
    ) {
      return "Không thể gỡ quản trị viên duy nhất đang hoạt động.";
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 text-amber-700 shrink-0" />
        <p>
          Mọi thay đổi vai trò và trạng thái đều được ghi nhật ký hệ thống. Hệ
          thống không cho phép vô tình hạ quyền hoặc tạm khóa quản trị viên
          duy nhất đang hoạt động. Khi gỡ người dùng, dữ liệu lịch sử và nhật
          ký vẫn được giữ lại.
        </p>
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl bg-amber-50/60 border border-amber-300/40 p-1 w-fit"
        role="tablist"
        aria-label="Lọc theo trạng thái người dùng"
      >
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.value)}
              className={`text-xs px-3 py-1.5 rounded-lg transition ${
                active
                  ? "bg-white text-forest shadow-sm font-medium"
                  : "text-emerald-900/70 hover:text-emerald-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {visibleUsers.length === 0 ? (
        <div className="card-cream rounded-2xl p-6 text-center text-sm text-emerald-900/70">
          Không có người dùng phù hợp với bộ lọc này.
        </div>
      ) : null}

      {/* Mobile cards */}
      <ul className="lg:hidden space-y-3">
        {visibleUsers.map((u) => (
          <li
            key={u.id}
            className="card-cream rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-forest truncate">
                  {u.full_name ?? "—"}
                  {u.id === currentUserId ? (
                    <span className="ml-2 text-[11px] text-emerald-900/55 font-normal">
                      (bạn)
                    </span>
                  ) : null}
                </div>
                <div className="text-[12px] text-emerald-900/65 break-all">
                  {u.email}
                </div>
              </div>
              {statusBadge(u)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-900/60">
              <div>
                <div className="uppercase tracking-wide">Ngày tạo</div>
                <div className="text-emerald-950 text-sm font-medium">
                  {formatVNDate(u.created_at)}
                </div>
              </div>
              <div>
                <div className="uppercase tracking-wide">Vai trò hiện tại</div>
                <div className="text-emerald-950 text-sm font-medium">
                  {roleLabel(u.role)}
                </div>
              </div>
            </div>
            <UserActions
              user={u}
              isSelf={u.id === currentUserId}
              busy={submitting === u.id}
              removeDisabledReason={removeDisabledReason(u)}
              onRoleChange={(r) => applyRoleChange(u, r)}
              onToggleActive={(active) => applyActiveChange(u, active)}
              onRequestRemove={() => setConfirm({ type: "remove", user: u })}
            />
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden lg:block card-cream rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-amber-100/40 text-emerald-900/65 text-[11px] uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Họ tên</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Vai trò</th>
                <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium">Ngày tạo</th>
                <th className="text-left px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-300/30">
              {visibleUsers.map((u) => (
                <tr key={u.id} className="text-emerald-950">
                  <td className="px-4 py-3 font-medium">
                    {u.full_name ?? "—"}
                    {u.id === currentUserId ? (
                      <span className="ml-2 text-[11px] text-emerald-900/55 font-normal">
                        (bạn)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-emerald-900/85">{u.email}</td>
                  <td className="px-4 py-3">{roleLabel(u.role)}</td>
                  <td className="px-4 py-3">{statusBadge(u)}</td>
                  <td className="px-4 py-3 text-emerald-900/85">
                    {formatVNDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <UserActions
                      user={u}
                      isSelf={u.id === currentUserId}
                      busy={submitting === u.id}
                      removeDisabledReason={removeDisabledReason(u)}
                      onRoleChange={(r) => applyRoleChange(u, r)}
                      onToggleActive={(active) =>
                        applyActiveChange(u, active)
                      }
                      onRequestRemove={() =>
                        setConfirm({ type: "remove", user: u })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form
        onSubmit={createUser}
        className="card-cream rounded-2xl p-4 lg:p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span className="icon-rim h-10 w-10 rounded-full flex items-center justify-center shrink-0">
            <UserCog className="h-4 w-4 text-amber-700" />
          </span>
          <div>
            <div className="font-semibold text-forest">Tạo tài khoản mới</div>
            <p className="text-[12px] text-emerald-900/60">
              Admin tạo tài khoản đăng nhập cho người dùng với quyền xem hoặc chỉnh sửa.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className="h-10 rounded-lg border border-amber-300/60 bg-white/75 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-400/40"
            placeholder="Họ tên"
            value={newUser.full_name}
            onChange={(e) => setNewUser((u) => ({ ...u, full_name: e.target.value }))}
            required
          />
          <input
            className="h-10 rounded-lg border border-amber-300/60 bg-white/75 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-400/40"
            type="email"
            placeholder="Email đăng nhập"
            value={newUser.email}
            onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
            required
          />
          <input
            className="h-10 rounded-lg border border-amber-300/60 bg-white/75 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-400/40"
            type="text"
            placeholder="Mật khẩu"
            value={newUser.password}
            onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
            required
          />
          <Select
            value={newUser.role}
            onValueChange={(role) => setNewUser((u) => ({ ...u, role: role as Role }))}
          >
            <SelectTrigger className="h-10 bg-white/75 border-amber-300/60">
              <SelectValue placeholder="Chọn quyền" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Quyền xem</SelectItem>
              <SelectItem value="staff">Quyền chỉnh sửa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={creating}>
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Tạo tài khoản
        </Button>
      </form>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-forest">
              {confirm?.type === "remove" ? (
                <UserMinus className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {confirm?.type === "remove"
                ? "Gỡ người dùng khỏi cửa hàng?"
                : "Xác nhận thay đổi quyền quản trị"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.type === "remove" ? (
                <>
                  Người dùng này sẽ không còn quyền truy cập dữ liệu của cửa
                  hàng. Nhật ký hệ thống vẫn được giữ lại để đối chiếu.
                  <br />
                  <span className="block mt-2 text-emerald-900/85">
                    Đối tượng:{" "}
                    <strong>
                      {confirm.user.full_name ?? confirm.user.email}
                    </strong>
                  </span>
                </>
              ) : (
                <>
                  {confirm?.type === "role"
                    ? `Bạn đang thay đổi vai trò của ${
                        confirm.user.full_name ?? confirm.user.email
                      } sang ${roleLabel(confirm.newRole)}.`
                    : confirm?.type === "active"
                    ? `Bạn đang ${
                        confirm.newActive ? "kích hoạt" : "tạm khóa"
                      } ${confirm.user.full_name ?? confirm.user.email}.`
                    : ""}
                  <br />
                  Đây là quản trị viên duy nhất đang hoạt động trong cửa hàng.
                  Sau thay đổi này, có thể không còn ai có quyền quản trị. Bạn
                  có chắc chắn muốn tiếp tục?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirm(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting !== null}
              onClick={async () => {
                if (!confirm) return;
                if (confirm.type === "role") {
                  await applyRoleChange(confirm.user, confirm.newRole, true);
                } else if (confirm.type === "active") {
                  await applyActiveChange(
                    confirm.user,
                    confirm.newActive,
                    true
                  );
                } else {
                  await applyRemove(confirm.user);
                }
                setConfirm(null);
              }}
            >
              {submitting !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirm?.type === "remove" ? (
                "Gỡ người dùng"
              ) : (
                "Tôi hiểu, tiếp tục"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeAdminCount === 0 ? (
        <p className="text-xs text-rose-700">
          Cảnh báo: hiện không có quản trị viên nào đang hoạt động.
        </p>
      ) : null}
    </div>
  );
}

function UserActions({
  user,
  isSelf,
  busy,
  removeDisabledReason,
  onRoleChange,
  onToggleActive,
  onRequestRemove,
}: {
  user: SettingsUser;
  isSelf: boolean;
  busy: boolean;
  removeDisabledReason: string | null;
  onRoleChange: (role: Role) => void;
  onToggleActive: (active: boolean) => void;
  onRequestRemove: () => void;
}) {
  const isRemoved = Boolean(user.removed_at);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={user.role}
        onValueChange={(v) => {
          if (v !== user.role) onRoleChange(v as Role);
        }}
        disabled={busy || isRemoved}
      >
        <SelectTrigger className="h-9 w-[160px] bg-white/70 border-amber-300/60">
          <SelectValue placeholder="Chọn vai trò" />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant={user.is_active ? "outline" : "default"}
        size="sm"
        disabled={busy || isSelf || isRemoved}
        title={
          isRemoved
            ? "Người dùng đã bị gỡ khỏi cửa hàng."
            : isSelf
            ? "Bạn không thể tự tạm khóa tài khoản của mình."
            : user.is_active
            ? "Tạm khóa người dùng"
            : "Kích hoạt người dùng"
        }
        onClick={() => onToggleActive(!user.is_active)}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : user.is_active ? (
          "Tạm khóa"
        ) : (
          "Kích hoạt"
        )}
      </Button>
      {!isRemoved ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-rose-700 border-rose-300/70 hover:bg-rose-50 hover:text-rose-900"
          disabled={busy || removeDisabledReason !== null}
          title={removeDisabledReason ?? "Gỡ người dùng khỏi cửa hàng"}
          onClick={onRequestRemove}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Gỡ"
          )}
        </Button>
      ) : null}
    </div>
  );
}
