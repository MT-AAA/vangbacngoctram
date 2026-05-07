"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck, UserCog } from "lucide-react";
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

export type SettingsUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
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
    };

export function UserManagement({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: SettingsUser[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingAction | null>(null);

  const activeAdminCount = users.filter(
    (u) => u.role === "admin" && u.is_active
  ).length;

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 text-amber-700 shrink-0" />
        <p>
          Mọi thay đổi vai trò và trạng thái đều được ghi nhật ký hệ thống. Hệ
          thống không cho phép vô tình hạ quyền hoặc tạm khóa quản trị viên
          duy nhất đang hoạt động.
        </p>
      </div>

      {/* Mobile cards */}
      <ul className="lg:hidden space-y-3">
        {users.map((u) => (
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
              <Badge variant={u.is_active ? "success" : "secondary"}>
                {u.is_active ? "Đang hoạt động" : "Tạm khóa"}
              </Badge>
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
              onRoleChange={(r) => applyRoleChange(u, r)}
              onToggleActive={(active) => applyActiveChange(u, active)}
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
              {users.map((u) => (
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
                  <td className="px-4 py-3">
                    <Badge variant={u.is_active ? "success" : "secondary"}>
                      {u.is_active ? "Đang hoạt động" : "Tạm khóa"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-emerald-900/85">
                    {formatVNDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <UserActions
                      user={u}
                      isSelf={u.id === currentUserId}
                      busy={submitting === u.id}
                      onRoleChange={(r) => applyRoleChange(u, r)}
                      onToggleActive={(active) =>
                        applyActiveChange(u, active)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invitation placeholder */}
      <div className="card-cream rounded-2xl p-4 lg:p-5 flex items-start gap-3">
        <span className="icon-rim h-10 w-10 rounded-full flex items-center justify-center shrink-0">
          <UserCog className="h-4 w-4 text-amber-700" />
        </span>
        <div className="text-sm text-emerald-900/85 space-y-1">
          <div className="font-semibold text-forest">Mời người dùng mới</div>
          <p>Tính năng mời người dùng sẽ được bổ sung sau.</p>
          <p className="text-[12px] text-emerald-900/60">
            Tạm thời, vui lòng yêu cầu người dùng mới đăng ký bằng email và
            liên hệ quản trị viên để được gán vào cửa hàng.
          </p>
        </div>
      </div>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-forest">
              <Lock className="h-4 w-4" />
              Xác nhận thay đổi quyền quản trị
            </DialogTitle>
            <DialogDescription>
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
              Sau thay đổi này, có thể không còn ai có quyền quản trị. Bạn có
              chắc chắn muốn tiếp tục?
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
                } else {
                  await applyActiveChange(
                    confirm.user,
                    confirm.newActive,
                    true
                  );
                }
                setConfirm(null);
              }}
            >
              {submitting !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
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
  onRoleChange,
  onToggleActive,
}: {
  user: SettingsUser;
  isSelf: boolean;
  busy: boolean;
  onRoleChange: (role: Role) => void;
  onToggleActive: (active: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={user.role}
        onValueChange={(v) => {
          if (v !== user.role) onRoleChange(v as Role);
        }}
        disabled={busy}
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
        disabled={busy || isSelf}
        title={
          isSelf
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
    </div>
  );
}
