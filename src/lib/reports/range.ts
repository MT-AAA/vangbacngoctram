/**
 * URL-driven date range + period parser shared by every `/reports/*` page.
 *
 * Reports accept three search params:
 *   - `period` ∈ { day, month, quarter, year, custom } (default: month)
 *   - `from`   ISO date (YYYY-MM-DD), defaults to 1st-of-current-month
 *   - `to`     ISO date (YYYY-MM-DD), defaults to last-of-current-month
 *
 * When `period` is one of day/month/quarter/year and the user did NOT pass
 * explicit `from`/`to`, the bounds are auto-computed against `now`. When the
 * user passes explicit dates, the bounds are honoured verbatim and the period
 * is treated as the user's chosen bucket size.
 *
 * The result also exposes a `buckets` array of `{ start, end, label }` so
 * time-series reports (Phase 2E #1) can render rows directly without
 * re-deriving the bucket boundaries on the client.
 */

export type ReportPeriod = "day" | "month" | "quarter" | "year" | "custom";

export type ReportBucket = {
  /** Inclusive ISO start (YYYY-MM-DD). */
  start: string;
  /** Inclusive ISO end (YYYY-MM-DD). */
  end: string;
  /** Human-readable Vietnamese label, e.g. "01/02", "T2/2026", "Q1/2026", "2026". */
  label: string;
};

export type ReportRange = {
  period: ReportPeriod;
  from: string;
  to: string;
  /** Vietnamese-friendly label for the whole range. */
  label: string;
  /** Bucket size to use for time-series aggregation. */
  bucketKind: "day" | "month" | "quarter" | "year";
  buckets: ReportBucket[];
};

const pad = (n: number) => String(n).padStart(2, "0");

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )}`;
}

function vnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseIso(iso: string | undefined | null): Date | null {
  if (!iso || !ISO_RE.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfMonth(ref: Date): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
}

function endOfMonth(ref: Date): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
}

function startOfQuarter(ref: Date): Date {
  const q = Math.floor(ref.getUTCMonth() / 3);
  return new Date(Date.UTC(ref.getUTCFullYear(), q * 3, 1));
}

function endOfQuarter(ref: Date): Date {
  const q = Math.floor(ref.getUTCMonth() / 3);
  return new Date(Date.UTC(ref.getUTCFullYear(), q * 3 + 3, 0));
}

function startOfYear(ref: Date): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
}

function endOfYear(ref: Date): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), 11, 31));
}

function eachDay(from: Date, to: Date): ReportBucket[] {
  const out: ReportBucket[] = [];
  const cursor = new Date(from.getTime());
  while (cursor.getTime() <= to.getTime()) {
    const iso = isoOf(cursor);
    out.push({
      start: iso,
      end: iso,
      label: `${pad(cursor.getUTCDate())}/${pad(cursor.getUTCMonth() + 1)}`,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function eachMonth(from: Date, to: Date): ReportBucket[] {
  const out: ReportBucket[] = [];
  const cursor = startOfMonth(from);
  while (cursor.getTime() <= to.getTime()) {
    const bs = new Date(cursor.getTime());
    const be = endOfMonth(cursor);
    out.push({
      start: isoOf(bs > from ? bs : from),
      end: isoOf(be < to ? be : to),
      label: `T${pad(bs.getUTCMonth() + 1)}/${bs.getUTCFullYear()}`,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

function eachQuarter(from: Date, to: Date): ReportBucket[] {
  const out: ReportBucket[] = [];
  const cursor = startOfQuarter(from);
  while (cursor.getTime() <= to.getTime()) {
    const bs = new Date(cursor.getTime());
    const be = endOfQuarter(cursor);
    const q = Math.floor(bs.getUTCMonth() / 3) + 1;
    out.push({
      start: isoOf(bs > from ? bs : from),
      end: isoOf(be < to ? be : to),
      label: `Q${q}/${bs.getUTCFullYear()}`,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 3);
  }
  return out;
}

function eachYear(from: Date, to: Date): ReportBucket[] {
  const out: ReportBucket[] = [];
  let y = from.getUTCFullYear();
  const yEnd = to.getUTCFullYear();
  while (y <= yEnd) {
    const bs = new Date(Date.UTC(y, 0, 1));
    const be = new Date(Date.UTC(y, 11, 31));
    out.push({
      start: isoOf(bs > from ? bs : from),
      end: isoOf(be < to ? be : to),
      label: `${y}`,
    });
    y += 1;
  }
  return out;
}

export function bucketize(
  bucketKind: ReportRange["bucketKind"],
  from: string,
  to: string
): ReportBucket[] {
  const fromDate = parseIso(from);
  const toDate = parseIso(to);
  if (!fromDate || !toDate || fromDate > toDate) return [];
  switch (bucketKind) {
    case "day":
      return eachDay(fromDate, toDate);
    case "month":
      return eachMonth(fromDate, toDate);
    case "quarter":
      return eachQuarter(fromDate, toDate);
    case "year":
      return eachYear(fromDate, toDate);
  }
}

export function parseReportRange(
  searchParams: Record<string, string | string[] | undefined>,
  now: Date = new Date()
): ReportRange {
  const get = (k: string): string | undefined => {
    const v = searchParams[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const periodParam = get("period");
  const period: ReportPeriod = (
    ["day", "month", "quarter", "year", "custom"] as ReportPeriod[]
  ).includes(periodParam as ReportPeriod)
    ? (periodParam as ReportPeriod)
    : "month";

  const fromParam = get("from");
  const toParam = get("to");
  const explicit = !!(fromParam && toParam);

  let from: string;
  let to: string;

  if (explicit) {
    from = fromParam!;
    to = toParam!;
  } else {
    let fromDate: Date;
    let toDate: Date;
    switch (period) {
      case "day":
      case "month":
        fromDate = startOfMonth(now);
        toDate = endOfMonth(now);
        break;
      case "quarter":
        fromDate = startOfQuarter(now);
        toDate = endOfQuarter(now);
        break;
      case "year":
        fromDate = startOfYear(now);
        toDate = endOfYear(now);
        break;
      case "custom":
        fromDate = startOfMonth(now);
        toDate = endOfMonth(now);
        break;
    }
    from = isoOf(fromDate);
    to = isoOf(toDate);
  }

  const bucketKind: ReportRange["bucketKind"] =
    period === "custom" ? "day" : (period as ReportRange["bucketKind"]);

  const buckets = bucketize(bucketKind, from, to);

  let label: string;
  if (period === "year" && from.endsWith("-01-01") && to.endsWith("-12-31")) {
    label = `Năm ${from.slice(0, 4)}`;
  } else if (
    period === "quarter" &&
    /-(01|04|07|10)-01$/.test(from) &&
    /-(03|06|09|12)-(30|31)$/.test(to)
  ) {
    const month = Number(from.slice(5, 7));
    const q = Math.floor((month - 1) / 3) + 1;
    label = `Quý ${q}/${from.slice(0, 4)}`;
  } else if (
    period === "month" &&
    from.slice(0, 7) === to.slice(0, 7) &&
    from.endsWith("-01")
  ) {
    label = `Tháng ${from.slice(5, 7)}/${from.slice(0, 4)}`;
  } else {
    label = `${vnDate(from)} → ${vnDate(to)}`;
  }

  return { period, from, to, label, bucketKind, buckets };
}

export function rangeToQueryString(
  range: Pick<ReportRange, "period" | "from" | "to">,
  extra: Record<string, string | undefined> = {}
): string {
  const params = new URLSearchParams();
  params.set("period", range.period);
  params.set("from", range.from);
  params.set("to", range.to);
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
  }
  return params.toString();
}
