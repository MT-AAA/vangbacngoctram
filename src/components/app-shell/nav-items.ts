import {
  LayoutDashboard,
  FileSpreadsheet,
  Receipt,
  Tag,
  ShoppingBag,
  Boxes,
  Calculator,
  BarChart3,
  History,
  Settings,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";

export type Role = Database["public"]["Enums"]["user_role"];

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
};

/**
 * Shared navigation items used by both the desktop sidebar and the mobile
 * drawer. Order here is the order shown to the user.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/import", label: "Nhập Excel", icon: FileSpreadsheet },
  { href: "/sales", label: "Bán hàng", icon: Receipt },
  { href: "/issues", label: "Cần xử lý", icon: AlertTriangle },
  { href: "/customer-purchases", label: "Mua từ khách", icon: ShoppingBag },
  { href: "/inventory", label: "Tồn kho", icon: Boxes },
  { href: "/tax-reports", label: "Báo cáo thuế", icon: Calculator },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/categories", label: "Phân loại sản phẩm", icon: Tag },
  {
    href: "/audit-logs",
    label: "Lịch sử hệ thống",
    icon: History,
    roles: ["admin"],
  },
  { href: "/settings", label: "Cài đặt", icon: Settings, roles: ["admin"] },
  { href: "/help", label: "Hướng dẫn sử dụng", icon: HelpCircle },
];

export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "admin":
      return "Quản trị viên";
    case "staff":
      return "Nhân viên";
    case "viewer":
      return "Người xem";
    default:
      return role;
  }
}

export function findNavItemByPath(pathname: string): NavItem | undefined {
  // Find best match: exact match first, then longest prefix.
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    if (pathname === item.href) return item;
    if (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best;
}
