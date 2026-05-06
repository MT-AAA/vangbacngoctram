import { Bell, Search, LogOut } from "lucide-react";

type ProfileWithStore = {
  id: string;
  store_id: string | null;
  role: string;
  full_name: string | null;
  email: string;
  store: { id: string; name: string } | { id: string; name: string }[] | null;
};

/**
 * Slim top bar shown above page content. Page title and period filter live
 * inside each page so they can take part in the page title hierarchy.
 */
export function TopBar({ profile }: { profile: ProfileWithStore }) {
  const initial = (profile.full_name?.[0] ?? profile.email?.[0] ?? "?").toUpperCase();
  const roleLabel =
    profile.role === "admin"
      ? "Quản trị viên"
      : profile.role === "staff"
      ? "Nhân viên"
      : "Người xem";

  return (
    <header className="flex h-16 items-center justify-end gap-3 px-6 lg:px-8">
      {/* Search */}
      <div className="relative hidden lg:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-900/60" />
        <input
          type="search"
          placeholder="Tìm kiếm..."
          className="h-10 w-56 rounded-xl card-cream pl-9 pr-3 text-sm placeholder:text-emerald-900/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
        />
      </div>
      {/* Bell */}
      <button
        type="button"
        aria-label="Thông báo"
        className="relative h-10 w-10 rounded-xl card-cream flex items-center justify-center text-emerald-900/80 hover:text-emerald-900"
      >
        <Bell className="h-4 w-4" />
      </button>
      {/* Admin chip */}
      <div className="flex items-center gap-3 rounded-xl card-cream px-3 py-1.5">
        <div className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-amber-300/60 shrink-0 bg-gradient-to-br from-emerald-700 to-emerald-900 flex items-center justify-center text-amber-100 text-sm font-semibold">
          {initial}
        </div>
        <div className="hidden sm:block leading-tight">
          <div className="text-sm font-semibold text-forest">
            {profile.full_name ?? profile.email}
          </div>
          <div className="text-[11px] text-emerald-900/60">{roleLabel}</div>
        </div>
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-amber-300/30 text-emerald-900/70"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </header>
  );
}
