import { ShoppingBag, ShoppingCart, Scale, FileText, ArrowDownCircle, AlertTriangle, Sparkles, FileSpreadsheet, CheckCircle2, Boxes, Clock, ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import { loadDashboard, type PeriodKey } from "@/lib/dashboard/data";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import {
  RevenueTaxLineChart,
  CategoryDonut,
  VATBarChart,
} from "@/components/dashboard/charts";
import { formatVND, formatVNDate, formatNumber } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string; from?: string; to?: string };
}) {
  const isISODate = (s: string | undefined): s is string =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

  const wantsCustom =
    searchParams.period === "custom" &&
    isISODate(searchParams.from) &&
    isISODate(searchParams.to) &&
    searchParams.from! <= searchParams.to!;

  const periodKey: PeriodKey = wantsCustom
    ? "custom"
    : searchParams.period === "day" ||
      searchParams.period === "quarter" ||
      searchParams.period === "year"
    ? (searchParams.period as PeriodKey)
    : "month";

  const data = await loadDashboard(
    periodKey,
    wantsCustom
      ? { from: searchParams.from!, to: searchParams.to! }
      : undefined
  );
  const { totals, changeVsPrev } = data;

  return (
    <div className="space-y-6 pt-1">
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] lg:text-[30px] font-semibold tracking-tight text-forest">
            Dashboard Thuế Cửa Hàng Vàng Bạc
          </h1>
          <p className="text-sm text-emerald-900/70 mt-1">
            Phương pháp thuế GTGT trực tiếp trên giá trị gia tăng — cho mua bán
            vàng, bạc, đá quý.
          </p>
        </div>
        <PeriodFilter
          active={periodKey}
          rangeLabel={data.range.label}
          customFrom={wantsCustom ? searchParams.from : undefined}
          customTo={wantsCustom ? searchParams.to : undefined}
        />
      </div>

      {totals.estimatedCount > 0 && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-700" />
            <div>
              <div className="font-medium">Dữ liệu đang tính theo ước tính</div>
              <div className="text-xs text-amber-900/70">
                Có {formatNumber(totals.estimatedCount, 0)} dòng bán đang dùng
                giá vốn bình quân (chưa có giá vốn thực).
              </div>
            </div>
          </div>
          <Link
            href="/issues/estimated"
            className="text-xs font-medium text-amber-900 underline-offset-4 hover:underline inline-flex items-center gap-1"
          >
            Xem danh sách <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Tổng bán ra"
          value={formatVND(totals.sales)}
          icon={ShoppingBag}
          changePct={changeVsPrev.sales}
        />
        <KpiCard
          label="Tổng mua vào tương ứng"
          value={formatVND(totals.cost)}
          icon={ShoppingCart}
          changePct={changeVsPrev.cost}
        />
        <KpiCard
          label="Chênh lệch GTGT"
          value={formatVND(totals.valueAdded)}
          icon={Scale}
          changePct={changeVsPrev.valueAdded}
          valueColorClass={totals.valueAdded < 0 ? "text-rose-700" : "text-gold"}
        />
        <KpiCard
          label="Thuế GTGT phải nộp"
          value={formatVND(totals.estimatedVAT)}
          icon={FileText}
          changePct={changeVsPrev.estimatedVAT}
        />
        <KpiCard
          label="Âm chuyển kỳ sau"
          value={formatVND(-totals.negativeCarriedOut)}
          icon={ArrowDownCircle}
          changePct={changeVsPrev.negativeCarriedOut}
          upIsGood={false}
          valueColorClass={
            totals.negativeCarriedOut > 0 ? "text-rose-700" : "text-gold"
          }
        />
      </div>

      <div className="card-cream rounded-2xl p-4 lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-emerald-800" />
            <h2 className="text-lg font-semibold text-forest">
              Tổng quan hàng hóa
            </h2>
          </div>
          <Link
            href="/inventory"
            className="text-xs text-emerald-900/65 hover:text-emerald-900 inline-flex items-center gap-1"
          >
            Quản lý tồn kho
            <span aria-hidden>→</span>
          </Link>
        </div>
        {data.inventorySnapshot.length === 0 ? (
          <p className="text-sm text-emerald-900/55">
            Chưa có dữ liệu tồn kho.
          </p>
        ) : (
          <GoodsOverviewTable
            inventory={data.inventorySnapshot.map((it) => {
              const totalAmount =
                it.average_unit_cost === null
                  ? null
                  : it.average_unit_cost * it.quantity;
              return {
                ...it,
                totalAmountLabel:
                  totalAmount === null ? "—" : formatVND(totalAmount),
                averageLabel:
                  it.average_unit_cost === null
                    ? "—"
                    : `${formatVND(it.average_unit_cost)} / ${it.qty_unit}`,
              };
            })}
            sales={data.salesByCategory.map((it) => ({
              ...it,
              totalAmountLabel: formatVND(it.amount),
              averageLabel:
                it.quantity > 0
                  ? `${formatVND(it.amount / it.quantity)} / ${it.qty_unit}`
                  : "—",
            }))}
            purchases={data.purchasesByCategory.map((it) => ({
              ...it,
              totalAmountLabel: formatVND(it.amount),
              averageLabel:
                it.quantity > 0
                  ? `${formatVND(it.amount / it.quantity)} / ${it.qty_unit}`
                  : "—",
            }))}
          />
        )}
        {(data.inventoryAlerts.missingCost > 0 ||
          data.inventoryAlerts.lowStock > 0) && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {data.inventoryAlerts.missingCost > 0 && (
              <Link
                href="/inventory?missing_cost=1"
                className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 ring-1 ring-amber-300/60 hover:bg-amber-200"
              >
                {data.inventoryAlerts.missingCost} hàng thiếu giá mua
              </Link>
            )}
            {data.inventoryAlerts.lowStock > 0 && (
              <Link
                href="/inventory?low_stock=1"
                className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-900 ring-1 ring-rose-300/60 hover:bg-rose-200"
              >
                {data.inventoryAlerts.lowStock} hàng tồn thấp
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card-cream rounded-2xl p-4 lg:p-5 xl:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-forest">
              Doanh thu &amp; Thuế theo thời gian
            </h2>
            <span className="text-xs text-emerald-900/60">
              {data.range.bucket === "day" ? "Theo ngày" : "Theo tháng"}
            </span>
          </div>
          <RevenueTaxLineChart data={data.series} />
        </div>

        <div className="card-cream rounded-2xl p-4 lg:p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-forest">
              Cơ cấu doanh thu
            </h2>
          </div>
          <CategoryDonut
            data={data.categoryShares}
            totalLabel={formatVND(totals.sales)}
          />
        </div>

        <div className="card-cream rounded-2xl p-4 lg:p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-forest">
              Thuế GTGT theo kỳ
            </h2>
            <span className="text-xs text-emerald-900/60">
              {data.vatByPeriod.length} kỳ gần nhất
            </span>
          </div>
          {data.vatByPeriod.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-emerald-900/55">
              Chưa có báo cáo kỳ nào.{" "}
              <Link href="/tax-reports" className="ml-1 underline">
                Tạo kỳ
              </Link>
            </div>
          ) : (
            <VATBarChart data={data.vatByPeriod} />
          )}
        </div>
      </div>

      {/* Bottom row: 4 modules */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Recent transactions */}
        <div className="card-cream rounded-2xl p-4 lg:p-5 xl:col-span-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-forest">
              Giao dịch gần đây
            </h2>
            <Link
              href="/sales"
              className="text-xs text-emerald-900/65 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              Xem tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recentTransactions.length === 0 ? (
            <p className="text-sm text-emerald-900/55">Chưa có giao dịch nào.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-emerald-900/55">
                    <th className="text-left font-normal py-2 px-1">Ngày</th>
                    <th className="text-left font-normal py-2 px-1">Sản phẩm</th>
                    <th className="text-left font-normal py-2 px-1">Nhóm</th>
                    <th className="text-right font-normal py-2 px-1">Bán ra</th>
                    <th className="text-right font-normal py-2 px-1">Mua vào</th>
                    <th className="text-right font-normal py-2 px-1">GTGT</th>
                    <th className="text-left font-normal py-2 px-1">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-300/30">
                  {data.recentTransactions.map((t) => (
                    <tr key={t.id} className="text-emerald-950">
                      <td className="py-2 px-1 text-xs text-emerald-900/70">
                        {formatVNDate(t.sale_date)}
                      </td>
                      <td className="py-2 px-1 max-w-[160px]">
                        <div className="flex items-center gap-2">
                          <span className="h-7 w-7 rounded-lg bg-amber-200/40 ring-1 ring-amber-400/50 flex items-center justify-center text-amber-700 text-xs">
                            <Sparkles className="h-3 w-3" />
                          </span>
                          <span className="truncate">{t.product_name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        {t.category_name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-200/40 ring-1 ring-amber-300/60 text-[11px] text-amber-900">
                            {t.category_name}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-900/50">—</span>
                        )}
                      </td>
                      <td className="py-2 px-1 text-right">
                        {formatVND(t.total_amount)}
                      </td>
                      <td className="py-2 px-1 text-right">
                        {t.purchase_cost_amount === null
                          ? "—"
                          : formatVND(t.purchase_cost_amount)}
                      </td>
                      <td className="py-2 px-1 text-right">
                        {t.value_added_amount === null
                          ? "—"
                          : formatVND(t.value_added_amount)}
                      </td>
                      <td className="py-2 px-1">
                        <StatusPill status={t.tax_calculation_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action items */}
        <div className="xl:col-span-3 space-y-4">
          <div className="card-cream rounded-2xl p-4 lg:p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <h2 className="text-base font-semibold text-forest">Cần xử lý</h2>
            </div>
            <ul className="space-y-2 text-sm">
              <ActionRow
                icon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
                label="dòng bán thiếu giá mua vào"
                count={totals.missingCount}
                tone="destructive"
                href="/issues/missing-cost"
              />
              <ActionRow
                icon={<Sparkles className="h-4 w-4 text-amber-700" />}
                label="sản phẩm chưa phân loại"
                count={totals.unclassifiedCount}
                tone="warning"
                href="/issues/unclassified"
              />
              <ActionRow
                icon={<FileText className="h-4 w-4 text-emerald-800" />}
                label="kỳ thuế GTGT âm"
                count={
                  totals.negativeCarriedOut > 0 ? 1 : 0
                }
                tone="info"
                href="/issues/negative-vat"
              />
              <ActionRow
                icon={<Sparkles className="h-4 w-4 text-amber-700" />}
                label="giao dịch đang tính theo ước tính"
                count={totals.estimatedCount}
                tone="warning"
                href="/issues/estimated"
              />
              <ActionRow
                icon={<Users className="h-4 w-4 text-amber-700" />}
                label="giao dịch mua thiếu phân loại"
                count={data.customerPurchases.missingCategoryCount}
                tone="warning"
                href="/customer-purchases?category=none"
              />
              <ActionRow
                icon={<Users className="h-4 w-4 text-rose-600" />}
                label="giao dịch mua thiếu số tiền"
                count={data.customerPurchases.missingAmountCount}
                tone="destructive"
                href="/customer-purchases"
              />
            </ul>
            <div className="mt-3">
              <a
                href="/issues"
                className="text-xs text-emerald-900/70 underline-offset-4 hover:underline"
              >
                Xem toàn bộ trang Cần xử lý →
              </a>
            </div>
          </div>
        </div>

        {/* Recent imports */}
        <div className="card-cream rounded-2xl p-4 lg:p-5 xl:col-span-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-800" />
              <h2 className="text-base font-semibold text-forest">
                Lịch sử import
              </h2>
            </div>
            <Link
              href="/import"
              className="text-xs text-emerald-900/65 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              Xem tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recentImports.length === 0 ? (
            <p className="text-sm text-emerald-900/55">
              Chưa có lần nhập nào.{" "}
              <Link href="/import" className="underline">
                Tải lên file đầu tiên
              </Link>
            </p>
          ) : (
            <ul className="space-y-2.5">
              {data.recentImports.map((i) => {
                const ok = i.status === "completed" && i.error_rows === 0;
                const warn = i.status === "completed" && i.error_rows > 0;
                return (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-amber-50/70 ring-1 ring-amber-300/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-emerald-950 truncate">
                        {i.file_name}
                      </div>
                      <div className="text-[11px] text-emerald-900/60 mt-0.5 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {formatVNDate(i.created_at)} •{" "}
                        {formatNumber(i.total_rows, 0)} dòng
                      </div>
                    </div>
                    {ok && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Thành công
                      </span>
                    )}
                    {warn && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
                        <AlertTriangle className="h-4 w-4" /> Cảnh báo
                      </span>
                    )}
                    {!ok && !warn && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs text-rose-700 font-medium">
                        <AlertTriangle className="h-4 w-4" />{" "}
                        {i.status === "failed" ? "Thất bại" : "Đang xử lý"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Customer purchases section */}
      <div className="card-cream rounded-2xl p-4 lg:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-800" />
            <h2 className="text-base font-semibold text-forest">
              Mua từ khách trong kỳ
            </h2>
          </div>
          <Link
            href="/customer-purchases"
            className="text-xs text-emerald-900/65 hover:text-emerald-900 inline-flex items-center gap-1"
          >
            Xem tất cả <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl bg-amber-50/70 ring-1 ring-amber-300/40 p-3">
            <div className="text-[11px] text-emerald-900/60">
              Tổng mua từ khách
            </div>
            <div className="mt-1 text-lg font-semibold text-gold">
              {formatVND(data.customerPurchases.totalAmount)}
            </div>
            <div className="text-[11px] text-emerald-900/60 mt-0.5">
              {formatNumber(data.customerPurchases.totalRows, 0)} giao dịch
            </div>
          </div>
          <div className="rounded-xl bg-amber-50/70 ring-1 ring-amber-300/40 p-3">
            <div className="text-[11px] text-emerald-900/60">
              Tính vào giá vốn bình quân
            </div>
            <div className="mt-1 text-lg font-semibold text-emerald-800">
              {formatVND(data.customerPurchases.taxInputAmount)}
            </div>
            <div className="text-[11px] text-emerald-900/60 mt-0.5">
              {formatNumber(data.customerPurchases.taxInputRows, 0)} giao dịch
            </div>
          </div>
          <div className="rounded-xl bg-amber-50/70 ring-1 ring-amber-300/40 p-3">
            <div className="text-[11px] text-emerald-900/60">
              Cần kiểm tra
            </div>
            <div className="mt-1 text-sm text-emerald-950 space-y-0.5">
              <div>
                Thiếu phân loại:{" "}
                <span className="font-semibold">
                  {data.customerPurchases.missingCategoryCount}
                </span>
              </div>
              <div>
                Thiếu số tiền:{" "}
                <span className="font-semibold">
                  {data.customerPurchases.missingAmountCount}
                </span>
              </div>
            </div>
          </div>
        </div>
        {data.customerPurchases.recent.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-900/55">
            Chưa có giao dịch mua từ khách nào trong kỳ.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-emerald-900/55 border-b border-amber-300/40">
                  <th className="py-2 pr-3">Ngày</th>
                  <th className="py-2 pr-3">Khách hàng</th>
                  <th className="py-2 pr-3">Sản phẩm</th>
                  <th className="py-2 pr-3">Phân loại</th>
                  <th className="py-2 pr-3 text-right">Số tiền</th>
                  <th className="py-2 pr-3">Tính giá vốn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-300/30">
                {data.customerPurchases.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 text-emerald-900/85 whitespace-nowrap">
                      {formatVNDate(r.purchase_date)}
                    </td>
                    <td className="py-2 pr-3 text-emerald-950">
                      {r.customer_name ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-emerald-950 max-w-[260px] truncate">
                      {r.product_name}
                    </td>
                    <td className="py-2 pr-3 text-emerald-900/85">
                      {r.category_name ?? "Chưa phân loại"}
                    </td>
                    <td className="py-2 pr-3 text-right text-emerald-950 font-medium">
                      {formatVND(r.total_amount)}
                    </td>
                    <td className="py-2 pr-3">
                      {r.is_tax_purchase_input ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Có
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-900/55">Không</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

type GoodsOverviewItem = {
  category: string;
  qty_unit: string;
  quantity: number;
  totalAmountLabel: string;
  averageLabel: string;
};

function GoodsOverviewTable({
  inventory,
  sales,
  purchases,
}: {
  inventory: GoodsOverviewItem[];
  sales: GoodsOverviewItem[];
  purchases: GoodsOverviewItem[];
}) {
  const categories = inventory.map((item) => item.category);
  const findItem = (items: GoodsOverviewItem[], category: string) =>
    items.find((item) => item.category === category);

  const sections = [
    { label: "Tồn kho", items: inventory },
    { label: "Mua từ khách", items: purchases },
    { label: "Bán hàng", items: sales },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {categories.map((category) => {
        const isSilver = category === "Bạc";
        return (
          <section
            key={category}
            className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-amber-300/45 shadow-sm"
          >
            <div className="border-b border-amber-300/35 bg-gradient-to-r from-amber-50/90 to-white px-4 py-3">
              <h3
                className={
                  isSilver
                    ? "text-base font-bold text-slate-500"
                    : "text-base font-bold text-gold"
                }
              >
                {category}
              </h3>
            </div>
            <div className="divide-y divide-amber-200/60 p-3">
              {sections.map((section) => {
                const item = findItem(section.items, category);
                if (!item) return null;
                return (
                  <div key={section.label} className="py-2 first:pt-0 last:pb-0">
                    <div className="mb-1.5 text-xs font-semibold text-emerald-900/70">
                      {section.label}
                    </div>
                    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-amber-300/45 bg-amber-50/35">
                      <MetricBox
                        label="Tổng KL"
                        value={formatNumber(item.quantity, 2)}
                        unit="chỉ"
                      />
                      <MetricBox label="Tổng tiền" value={item.totalAmountLabel} />
                      <MetricBox label="Đơn giá BQ" value={item.averageLabel} strong />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MetricBox({
  label,
  value,
  unit,
  strong = false,
}: {
  label: string;
  value: string;
  unit?: string;
  strong?: boolean;
}) {
  return (
    <div className="border-r border-amber-300/45 px-2.5 py-2 last:border-r-0">
      <div className="text-[10px] uppercase tracking-wide text-emerald-900/45">
        {label}
      </div>
      <div
        className={
          unit
            ? "mt-0.5 text-[13px] font-bold leading-tight text-gold"
            : strong
              ? "mt-0.5 text-[13px] font-bold leading-tight text-emerald-800"
              : "mt-0.5 text-[13px] font-semibold leading-tight text-emerald-950"
        }
      >
        {value}
        {unit && <span className="ml-1 text-gold">{unit}</span>}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Hợp lệ
      </span>
    );
  }
  if (status === "estimated") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
        <Clock className="h-3 w-3" /> Lúc tính
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-rose-700">
      <AlertTriangle className="h-3 w-3" /> Thiếu giá vốn
    </span>
  );
}

function ActionRow({
  icon,
  count,
  label,
  tone,
  href,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  tone: "destructive" | "warning" | "info";
  href: string;
}) {
  const badge =
    tone === "destructive"
      ? "bg-rose-600 text-white"
      : tone === "warning"
      ? "bg-amber-500 text-white"
      : "bg-emerald-700 text-white";
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-amber-50/70 ring-1 ring-amber-300/40 px-3 py-2">
      <Link
        href={href}
        className="min-w-0 flex items-center gap-2 text-sm text-emerald-950 hover:underline"
      >
        {icon}
        <span className="truncate">
          <span className="font-semibold">{count}</span> {label}
        </span>
      </Link>
      <span
        className={`shrink-0 min-w-[28px] text-center px-2 py-0.5 rounded-md text-xs font-semibold ${badge}`}
      >
        {count}
      </span>
    </li>
  );
}
