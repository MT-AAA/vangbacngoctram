import { redirect } from "next/navigation";
import { Building2, Calculator, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UserManagement } from "@/components/settings/user-management";

export const metadata = {
  title: "Cài đặt — Phần Mềm Quản Lý Vàng Bạc",
};

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="card-cream rounded-2xl p-6">
        <h1 className="text-xl font-semibold text-forest">Cài đặt</h1>
        <p className="mt-2 text-sm text-emerald-900/75">
          Chỉ quản trị viên mới truy cập được trang Cài đặt.
        </p>
      </div>
    );
  }

  const [{ data: store }, { data: settings }, { data: members }] =
    await Promise.all([
      supabase
        .from("stores")
        .select("*")
        .eq("id", profile.store_id!)
        .maybeSingle(),
      supabase
        .from("tax_settings")
        .select("*")
        .eq("store_id", profile.store_id!)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, role, is_active, created_at, removed_at"
        )
        .eq("store_id", profile.store_id!)
        .order("created_at"),
    ]);

  const users = (members ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name,
    email: m.email,
    role: m.role,
    is_active: m.is_active,
    created_at: m.created_at,
    removed_at: m.removed_at,
  }));

  return (
    <div className="space-y-6 pt-1">
      <div>
        <h1 className="text-[24px] lg:text-[28px] font-semibold tracking-tight text-forest">
          Cài đặt
        </h1>
        <p className="text-sm text-emerald-900/70 mt-1">
          Thông tin cửa hàng, cấu hình thuế và quản lý người dùng.
        </p>
      </div>

      <section className="card-cream rounded-2xl p-5 lg:p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="icon-rim h-10 w-10 rounded-full flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-amber-700" />
          </span>
          <h2 className="text-base lg:text-lg font-semibold text-forest">
            Cửa hàng
          </h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <SettingsField label="Tên cửa hàng" value={store?.name ?? "—"} />
          <SettingsField
            label="Mã số thuế"
            value={store?.tax_code ?? "Chưa cập nhật"}
          />
          <SettingsField
            label="Địa chỉ"
            value={store?.address ?? "Chưa cập nhật"}
          />
        </dl>
      </section>

      <section className="card-cream rounded-2xl p-5 lg:p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="icon-rim h-10 w-10 rounded-full flex items-center justify-center shrink-0">
            <Calculator className="h-4 w-4 text-amber-700" />
          </span>
          <div>
            <h2 className="text-base lg:text-lg font-semibold text-forest">
              Cài đặt thuế GTGT
            </h2>
            <p className="text-xs text-emerald-900/70">
              Phương pháp tính thuế áp dụng cho mua bán vàng, bạc, đá quý.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <SettingsField
            label="Phương pháp"
            value={
              settings?.method === "direct_value_added"
                ? "Trực tiếp trên giá trị gia tăng"
                : settings?.method ?? "—"
            }
          />
          <SettingsField
            label="Thuế suất mặc định"
            value={
              settings?.vat_rate !== null && settings?.vat_rate !== undefined
                ? `${settings.vat_rate}%`
                : "—"
            }
          />
        </dl>
      </section>

      <section className="card-cream rounded-2xl p-5 lg:p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="icon-rim h-10 w-10 rounded-full flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-amber-700" />
          </span>
          <div>
            <h2 className="text-base lg:text-lg font-semibold text-forest">
              Người dùng &amp; phân quyền
            </h2>
            <p className="text-xs text-emerald-900/70">
              Quản lý vai trò và trạng thái của các tài khoản trong cửa hàng.
            </p>
          </div>
        </div>
        <UserManagement currentUserId={user.id} users={users} />
      </section>
    </div>
  );
}

function SettingsField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-amber-50/70 ring-1 ring-amber-300/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-emerald-900/55">
        {label}
      </div>
      <div className="mt-1 text-sm text-emerald-950 font-medium break-words">
        {value}
      </div>
    </div>
  );
}
