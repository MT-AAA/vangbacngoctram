"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paginationRange } from "@/lib/pagination";

type Props = {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  compact?: boolean;
};

/**
 * URL-driven pagination footer for the /sales table. Preserves all existing
 * search params (filters) when changing page, and emits no controls when there
 * is at most a single page.
 */
export function SalesPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  compact = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tokens = useMemo(
    () => paginationRange({ page, totalPages, siblings: 1 }),
    [page, totalPages]
  );

  if (totalPages <= 1) {
    return (
      <div className={compact ? "hidden" : "text-xs text-muted-foreground"}>
        Hiển thị {totalCount === 0 ? 0 : 1}–{totalCount} trên {totalCount} giao
        dịch
      </div>
    );
  }

  const buildHref = (target: number): string => {
    const sp = new URLSearchParams(searchParams.toString());
    if (target <= 1) sp.delete("page");
    else sp.set("page", String(target));
    const query = sp.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const goTo = (target: number) => {
    if (target === page) return;
    router.push(buildHref(target));
  };

  const atFirst = page <= 1;
  const atLast = page >= totalPages;
  const fromRow = (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, totalCount);

  return (
    <nav
      className={
        compact
          ? "flex justify-end"
          : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      }
      aria-label="Phân trang giao dịch"
    >
      {!compact && (
        <div className="text-xs text-muted-foreground">
          Hiển thị {fromRow.toLocaleString("vi-VN")}–{toRow.toLocaleString("vi-VN")}{" "}
          trên {totalCount.toLocaleString("vi-VN")} giao dịch
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          aria-label="Đầu"
          disabled={atFirst}
          onClick={() => goTo(1)}
          className="h-8 px-2"
        >
          <ChevronsLeft className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Đầu</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Trước"
          disabled={atFirst}
          onClick={() => goTo(page - 1)}
          className="h-8 px-2"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Trước</span>
        </Button>

        <div className="hidden flex-wrap items-center gap-1 md:flex">
          {tokens.map((tok, idx) =>
            tok === "…" ? (
              <span
                key={`gap-${idx}`}
                className="px-2 text-xs text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Button
                key={tok}
                variant={tok === page ? "default" : "outline"}
                size="sm"
                aria-label={`Trang ${tok}`}
                aria-current={tok === page ? "page" : undefined}
                onClick={() => goTo(tok)}
                className="h-8 min-w-[2rem] px-2"
              >
                {tok}
              </Button>
            )
          )}
        </div>

        <span className="px-2 text-xs text-muted-foreground md:hidden">
          Trang {page} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          aria-label="Sau"
          disabled={atLast}
          onClick={() => goTo(page + 1)}
          className="h-8 px-2"
        >
          <span className="mr-1 hidden sm:inline">Sau</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Cuối"
          disabled={atLast}
          onClick={() => goTo(totalPages)}
          className="h-8 px-2"
        >
          <span className="mr-1 hidden sm:inline">Cuối</span>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
