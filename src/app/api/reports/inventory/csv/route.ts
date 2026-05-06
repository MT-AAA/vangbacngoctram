import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadInventoryReport } from "@/lib/reports/inventory";
import { toCsv, csvHeaders } from "@/lib/reports/csv";

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const report = await loadInventoryReport(supabase, {
    categoryId: category,
  });

  const csv = toCsv(
    report.rows.map((r) => ({
      category_name: r.category_name,
      name: r.name,
      sku: r.sku ?? "",
      quantity_on_hand: r.quantity_on_hand,
      weight: r.weight ?? "",
      weight_unit: r.weight_unit ?? "",
      weight_chi: r.weight_chi ?? "",
      unit_cost: r.unit_cost,
      total_cost: r.total_cost,
      status: r.status,
      created_at: r.created_at,
    })),
    [
      { key: "category_name", header: "Nhóm" },
      { key: "name", header: "Tên mặt hàng" },
      { key: "sku", header: "SKU" },
      { key: "quantity_on_hand", header: "SL tồn" },
      { key: "weight", header: "Trọng lượng" },
      { key: "weight_unit", header: "Đơn vị" },
      { key: "weight_chi", header: "Trọng lượng (chỉ)" },
      { key: "unit_cost", header: "Đơn giá nhập" },
      { key: "total_cost", header: "Tổng giá vốn" },
      { key: "status", header: "Trạng thái" },
      { key: "created_at", header: "Ngày nhập" },
    ],
    {
      prefixLines: [
        "# Snapshot tồn kho hiện tại (in_stock).",
      ],
    }
  );

  return new NextResponse(csv, {
    headers: csvHeaders(`inventory_${new Date().toISOString().slice(0, 10)}.csv`),
  });
}
