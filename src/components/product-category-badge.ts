import { cn } from "@/lib/utils";

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  "vàng ta": "border-amber-300/70 bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-900 shadow-sm shadow-amber-200/50 hover:from-amber-100 hover:to-yellow-50",
  "vang ta": "border-amber-300/70 bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-900 shadow-sm shadow-amber-200/50 hover:from-amber-100 hover:to-yellow-50",
  "vàng tây": "border-orange-300/70 bg-gradient-to-r from-orange-100 to-rose-50 text-orange-900 shadow-sm shadow-orange-200/50 hover:from-orange-100 hover:to-rose-50",
  "vang tay": "border-orange-300/70 bg-gradient-to-r from-orange-100 to-rose-50 text-orange-900 shadow-sm shadow-orange-200/50 hover:from-orange-100 hover:to-rose-50",
  bạc: "border-slate-300/80 bg-gradient-to-r from-slate-100 to-sky-50 text-slate-800 shadow-sm shadow-slate-200/60 hover:from-slate-100 hover:to-sky-50",
  bac: "border-slate-300/80 bg-gradient-to-r from-slate-100 to-sky-50 text-slate-800 shadow-sm shadow-slate-200/60 hover:from-slate-100 hover:to-sky-50",
};

export function categoryBadgeClassName(name?: string | null, className?: string) {
  const key = name?.trim().toLowerCase() ?? "";
  return cn(
    "border font-semibold tracking-tight",
    CATEGORY_BADGE_STYLES[key] ??
      "border-muted-foreground/20 bg-muted text-muted-foreground hover:bg-muted",
    className
  );
}
