import Link from "next/link";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportFilterBar } from "@/components/reports/filter-bar";
import { PrintReportButton } from "@/components/reports/print-button";
import type { ReportRange } from "@/lib/reports/range";
import { rangeToQueryString } from "@/lib/reports/range";

type CategoryOption = { id: string; name: string };

type Props = {
  title: string;
  description?: string;
  range: ReportRange;
  showCategoryFilter?: boolean;
  categoryOptions?: CategoryOption[];
  category?: string;
  /** Slug of the matching CSV API endpoint (e.g. "sales-by-time"). When
   * provided, the shell renders a "Tải CSV" button. */
  csvSlug?: string;
  /** When true, the report has at least one row computed via the
   * average-cost fallback. The shell renders the "Dữ liệu đang tính theo
   * ước tính" warning above the content. */
  hasEstimated?: boolean;
  estimatedCount?: number;
  /** Optional secondary note shown beside the title — e.g. "Phương pháp
   * trực tiếp" for the VAT report. */
  badge?: React.ReactNode;
  children: React.ReactNode;
};

export function ReportShell({
  title,
  description,
  range,
  showCategoryFilter,
  categoryOptions,
  category,
  csvSlug,
  hasEstimated,
  estimatedCount,
  badge,
  children,
}: Props) {
  const csvHref = csvSlug
    ? `/api/reports/${csvSlug}/csv?${rangeToQueryString(range, {
        category: category ?? undefined,
      })}`
    : undefined;

  return (
    <div className="report-shell space-y-4 print:space-y-3">
      <div className="report-print-only print:block hidden text-xs text-emerald-900/70">
        <div className="font-medium text-emerald-900">{title}</div>
        <div>Khoảng thời gian: {range.label}</div>
      </div>

      <div className="report-screen-only print:hidden flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Báo cáo
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {csvHref ? (
            <Button asChild size="sm" variant="outline">
              <a href={csvHref} download>
                <Download className="h-3 w-3" />
                <span className="ml-1">Tải CSV</span>
              </a>
            </Button>
          ) : null}
          <PrintReportButton />
        </div>
      </div>

      <div className="report-screen-only print:hidden">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          {title}
          {badge}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="report-screen-only print:hidden">
        <ReportFilterBar
          period={range.period}
          from={range.from}
          to={range.to}
          category={category}
          showCategory={!!showCategoryFilter}
          categoryOptions={categoryOptions}
        />
      </div>

      {hasEstimated ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-700" />
          <div>
            <div className="font-medium">Dữ liệu đang tính theo ước tính</div>
            <div className="text-xs text-amber-900/70">
              {estimatedCount && estimatedCount > 0
                ? `Có ${estimatedCount.toLocaleString("vi-VN")} dòng bán dùng giá vốn bình quân trong kỳ. Báo cáo phân biệt rõ phần exact và estimated.`
                : "Báo cáo có ít nhất một dòng dùng giá vốn bình quân; phần này được đánh dấu trong cột Ước tính."}
            </div>
          </div>
        </div>
      ) : null}

      <div className="report-content space-y-4">{children}</div>

      <div className="report-print-only print:block hidden text-[10px] text-emerald-900/60">
        Báo cáo lập ngày {new Date().toLocaleString("vi-VN")} ·
        Phương pháp tính thuế GTGT trực tiếp trên giá trị gia tăng
      </div>
    </div>
  );
}
