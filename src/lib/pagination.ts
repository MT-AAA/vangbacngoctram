/**
 * Helpers for paginated lists.
 *
 * - `clampPage(page, totalPages)` — clamp a 1-based page number into a valid
 *   range, defaulting to 1 when totals are missing.
 * - `paginationRange({ page, totalPages, siblings })` — compute the array of
 *   page tokens to render in a numeric pagination strip. Tokens are either a
 *   1-based page number or the string `"…"` representing an ellipsis gap.
 * - `pageOffset({ page, pageSize })` — compute the Supabase `from` / `to`
 *   indices for `range(...)`.
 */

export type PageToken = number | "…";

export function clampPage(page: number | null | undefined, totalPages: number): number {
  const tp = Math.max(1, totalPages || 1);
  const p = Math.floor(Number(page ?? 1));
  if (!Number.isFinite(p) || p < 1) return 1;
  if (p > tp) return tp;
  return p;
}

export function totalPagesOf(count: number | null | undefined, pageSize: number): number {
  const c = Math.max(0, Number(count ?? 0));
  const ps = Math.max(1, pageSize);
  return Math.max(1, Math.ceil(c / ps));
}

export function pageOffset({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}): { from: number; to: number } {
  const p = Math.max(1, Math.floor(page));
  const ps = Math.max(1, Math.floor(pageSize));
  const from = (p - 1) * ps;
  const to = from + ps - 1;
  return { from, to };
}

/**
 * Build a numeric pagination strip with first/last anchors and ellipsis
 * collapse. `siblings` controls how many neighbours are shown around the
 * current page (default 1). Always includes pages 1 and totalPages when they
 * fit.
 *
 *   paginationRange({ page: 5, totalPages: 9, siblings: 1 })
 *     → [1, "…", 4, 5, 6, "…", 9]
 *   paginationRange({ page: 1, totalPages: 5 })
 *     → [1, 2, 3, 4, 5]
 */
export function paginationRange({
  page,
  totalPages,
  siblings = 1,
}: {
  page: number;
  totalPages: number;
  siblings?: number;
}): PageToken[] {
  const tp = Math.max(1, totalPages || 1);
  const p = clampPage(page, tp);
  // Show every page when it's small enough to fit without ellipsis.
  // Width budget = 1 (first) + 1 (gap) + (2*siblings + 1) middle + 1 (gap) + 1 (last)
  const totalSlots = siblings * 2 + 5;
  if (tp <= totalSlots) {
    return Array.from({ length: tp }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(p - siblings, 1);
  const rightSibling = Math.min(p + siblings, tp);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < tp - 1;

  const tokens: PageToken[] = [1];

  if (showLeftEllipsis) {
    tokens.push("…");
  } else {
    for (let i = 2; i < leftSibling; i++) tokens.push(i);
  }

  for (let i = leftSibling; i <= rightSibling; i++) {
    if (i === 1 || i === tp) continue;
    tokens.push(i);
  }

  if (showRightEllipsis) {
    tokens.push("…");
  } else {
    for (let i = rightSibling + 1; i < tp; i++) tokens.push(i);
  }

  tokens.push(tp);
  return tokens;
}
