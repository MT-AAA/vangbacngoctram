import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadAvgSellingPrice } from "@/lib/reports/avg-selling-price";
import { toCsv, csvHeaders } from "@/lib/reports/csv";

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const range = parseReportRange(sp);
  const category = sp["category"] ?? null;

  const report = await loadAvgSellingPrice(supabase, range, {
    categoryId: category,
  });

  const csv = toCsv(
    [
      ...report.rows.map((r) => ({
        category_name: r.category_name,
        transaction_count: r.transaction_count,
        total_quantity: r.total_quantity,
        total_weight_chi: r.total_weight_chi,
        total_sales_amount: r.total_sales_amount,
        avg_unit_price: r.avg_unit_price ?? "",
        avg_price_per_chi: r.avg_price_per_chi ?? "",
      })),
      {
        category_name: "Tổng",
        transaction_count: report.totals.transaction_count,
        total_quantity: report.totals.total_quantity,
        total_weight_chi: report.totals.total_weight_chi,
        total_sales_amount: report.totals.total_sales_amount,
        avg_unit_price: report.totals.avg_unit_price ?? "",
        avg_price_per_chi: report.totals.avg_price_per_chi ?? "",
      },
    ],
    [
      { key: "category_name", header: "Nhóm" },
      { key: "transaction_count", header: "Số GD" },
      { key: "total_quantity", header: "Tổng SL" },
      { key: "total_weight_chi", header: "Trọng lượng (chỉ)" },
      { key: "total_sales_amount", header: "Doanh thu" },
      { key: "avg_unit_price", header: "Đơn giá BQ" },
      { key: "avg_price_per_chi", header: "Đồng/chỉ BQ" },
    ],
    {
      prefixLines: [
        `# Khoảng thời gian: ${range.label} (${range.from} → ${range.to})`,
        "# Quy ước: 1 chỉ ≈ 3.75g; 1 lượng = 10 chỉ.",
      ],
    }
  );

  return new NextResponse(csv, {
    headers: csvHeaders(`avg-selling-price_${range.from}_${range.to}.csv`),
  });
}
