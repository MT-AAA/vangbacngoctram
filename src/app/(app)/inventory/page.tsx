import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { InventorySummaryCards } from "@/components/inventory/summary-cards";
import { InventoryAccountingClient } from "@/components/inventory/inventory-accounting-client";
import {
  loadInventoryPeriodReport,
  type InventoryPeriod,
} from "@/lib/inventory/period-report";
import { buildRange } from "@/lib/dashboard/data";

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const dynamic = "force-dynamic";

function normalizePeriod(value?: string): InventoryPeriod {
  return value === "day" ||
    value === "month" ||
    value === "quarter" ||
    value === "year" ||
    value === "custom"
    ? value
    : "month";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: {
    period?: string;
    category?: string;
    from?: string;
    to?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.store_id) {
    return (
      <div className="rounded-md border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Tài khoản chưa được gán cửa hàng. Vui lòng liên hệ quản trị viên.
        </p>
      </div>
    );
  }

  const period = normalizePeriod(searchParams.period);
  const range = buildRange(
    period,
    new Date(),
    searchParams.from && searchParams.to
      ? { from: searchParams.from, to: searchParams.to }
      : undefined
  );
  const appliedFrom = searchParams.from ?? toISO(range.start);
  const appliedTo = searchParams.to ?? toISO(range.end);
  const [report, { data: categories }] = await Promise.all([
    loadInventoryPeriodReport(supabase, {
      period,
      category: searchParams.category ?? null,
      from: searchParams.from ?? null,
      to: searchParams.to ?? null,
    }),
    supabase
      .from("product_categories")
      .select("id, name, code")
      .order("display_order"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tồn kho</h1>
        <p className="text-sm text-muted-foreground">
          Hạch toán tồn kho theo rổ Vàng ta, Vàng tây, Bạc. Mặc định hiển thị
          lượng tồn đến hiện tại; có thể lọc ngày, tuần, tháng, quý.
        </p>
      </div>

      <InventorySummaryCards summary={report.summary} />

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo tồn kho theo kỳ</CardTitle>
          <CardDescription>
            Dữ liệu đầu kỳ lấy từ Cuối kỳ Q1/2026; mua từ khách và nhập tay làm
            tăng tồn, giao dịch bán gắn tồn kho làm giảm tồn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InventoryAccountingClient
            report={report}
            categories={categories ?? []}
            filters={{
              period,
              category: searchParams.category ?? "",
              from: appliedFrom,
              to: appliedTo,
              rangeLabel: range.label,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
