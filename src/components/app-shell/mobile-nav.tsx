"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";
import {
  findNavItemByPath,
  getNavItemsForRole,
  roleLabel,
  type Role,
} from "./nav-items";

type ProfileWithStore = {
  id: string;
  store_id: string | null;
  role: Role;
  full_name: string | null;
  email: string;
};

/**
 * Mobile + tablet top bar with hamburger menu and slide-out drawer.
 * Hidden at lg+ where the desktop sidebar takes over.
 */
export function MobileNav({ profile }: { profile: ProfileWithStore }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = getNavItemsForRole(profile.role);
  const current = findNavItemByPath(pathname);
  const initial = (
    profile.full_name?.[0] ??
    profile.email?.[0] ??
    "?"
  ).toUpperCase();

  // Close drawer whenever route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-2 px-3 sm:px-4 h-14 bg-forest-gradient text-amber-50 border-b border-amber-300/20">
        <button
          type="button"
          aria-label="Mở danh mục"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="h-10 w-10 -ml-1 inline-flex items-center justify-center rounded-lg hover:bg-amber-300/15"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <BrandLogo className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-[0.15em] text-gold leading-tight">
              NGỌC TRÂM
            </div>
            {current ? (
              <div className="text-[11px] text-amber-200/80 truncate">
                {current.label}
              </div>
            ) : null}
          </div>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <div
            className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-amber-300/60 bg-gradient-to-br from-emerald-700 to-emerald-900 flex items-center justify-center text-amber-100 text-sm font-semibold"
            title={profile.full_name ?? profile.email}
          >
            {initial}
          </div>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              aria-label="Đăng xuất"
              title="Đăng xuất"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-amber-300/15 text-amber-50/85"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Drawer + backdrop */}
      <div
        aria-hidden={!open}
        className={cn(
          "lg:hidden fixed inset-0 z-40 transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div
          className="absolute inset-0 bg-emerald-950/55 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Danh mục điều hướng"
          className={cn(
            "absolute inset-y-0 left-0 w-[84%] max-w-[320px] bg-forest-gradient text-amber-50 shadow-2xl flex flex-col transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-amber-300/15">
            <div className="flex items-center gap-3 min-w-0">
              <BrandLogo className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <div className="text-base font-semibold tracking-[0.16em] text-gold leading-tight">
                  NGỌC TRÂM
                </div>
                <div className="text-[10px] tracking-[0.28em] text-amber-200/75">
                  VÀNG BẠC ĐÁ QUÝ
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Đóng danh mục"
              onClick={() => setOpen(false)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-amber-300/15 text-amber-50/90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pt-3 pb-3 border-b border-amber-300/10">
            <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">
              Tài khoản
            </div>
            <div className="mt-1 text-sm font-medium truncate">
              {profile.full_name ?? profile.email}
            </div>
            <div className="text-[11px] text-amber-200/70">
              {roleLabel(profile.role)}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <ul className="space-y-1">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors",
                        active
                          ? "sidebar-pill"
                          : "text-amber-50/90 hover:bg-amber-300/15 hover:text-amber-50"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          active ? "text-emerald-950" : "text-amber-200/90"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      </div>
    </>
  );
}
