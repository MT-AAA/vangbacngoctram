"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";
import { getNavItemsForRole, roleLabel, type Role } from "./nav-items";

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = getNavItemsForRole(role);

  return (
    <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col text-amber-50 relative bg-forest-gradient">
      {/* Right gold seam */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-amber-300/70 to-transparent"
      />
      {/* Top brand */}
      <div className="flex flex-col items-center gap-2 px-6 pt-7 pb-5 border-b border-amber-300/15">
        <BrandLogo className="h-16 w-16 drop-shadow-[0_2px_8px_rgba(212,160,46,0.35)]" />
        <div className="text-center">
          <div className="text-xl tracking-[0.18em] font-semibold leading-tight text-gold">
            NGỌC TRÂM
          </div>
          <div className="mt-0.5 text-[10px] tracking-[0.32em] text-amber-200/70">
            VÀNG BẠC ĐÁ QUÝ
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "sidebar-pill"
                      : "text-amber-50/85 hover:bg-amber-300/10 hover:text-amber-50"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
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

      {/* Decorative footer (CSS-only "jewelry shimmer") */}
      <div className="relative h-32 mx-3 mb-4 rounded-xl overflow-hidden border border-amber-300/15">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(80px 60px at 30% 60%, rgba(255, 230, 160, 0.35), transparent 70%), radial-gradient(60px 40px at 70% 40%, rgba(255, 220, 140, 0.25), transparent 70%), radial-gradient(40px 30px at 50% 80%, rgba(255, 240, 180, 0.18), transparent 70%), linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.5))",
          }}
        />
        <div className="relative z-10 h-full flex items-end p-3 text-[10px] uppercase tracking-[0.18em] text-amber-200/60">
          <span>{roleLabel(role)}</span>
        </div>
      </div>
    </aside>
  );
}
