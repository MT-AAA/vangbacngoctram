import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { REPORT_CATALOGUE } from "@/lib/reports/types";

export default function ReportsLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Báo cáo</h1>
        <p className="text-sm text-muted-foreground">
          Bộ báo cáo phục vụ vận hành và đối soát thuế GTGT theo phương pháp
          trực tiếp. Mỗi báo cáo hỗ trợ lọc khoảng thời gian, xuất CSV và in
          (lưu PDF qua trình duyệt).
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_CATALOGUE.map((r, idx) => (
          <Card
            key={r.slug}
            className="hover:border-primary/40 transition-colors"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-1">
                  {r.hasRangeFilter ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Theo kỳ
                    </Badge>
                  ) : null}
                  {r.hasCategoryFilter ? (
                    <Badge variant="outline" className="text-[10px]">
                      Theo nhóm
                    </Badge>
                  ) : null}
                </div>
              </div>
              <CardTitle className="text-base">
                <Link
                  href={`/reports/${r.slug}`}
                  className="hover:underline inline-flex items-center gap-1"
                >
                  {r.title}
                  <ArrowRight className="h-3 w-3 opacity-60" />
                </Link>
              </CardTitle>
              <CardDescription className="text-xs">
                {r.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                {r.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Xuất CSV và PDF</CardTitle>
          <CardDescription className="text-xs">
            Mỗi báo cáo có nút <strong>Tải CSV</strong> (UTF-8 BOM, mở trực
            tiếp trong Excel) và <strong>In · Lưu PDF</strong> (in trực tiếp
            hoặc &quot;Save as PDF&quot; từ trình duyệt — không cần thư viện
            JS PDF). Nếu cần PDF có sẵn template, có thể bổ sung sau với
            @react-pdf/renderer.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
