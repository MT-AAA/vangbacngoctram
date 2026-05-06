import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReportRange } from "@/lib/reports/range";
import { loadCustomerPurchaseReport } from "@/lib/reports/customer-purchases";
import { toCsv, csvHeaders } from "@/lib/reports/csv";

export async function GET(request: Request) {
  const supabase = createClient();
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const range = parseReportRange(sp);
  const category = sp["category"] ?? null;
  const report = await loadCustomerPurchaseReport(supabase, range, {
    categoryId: category,
  });

  const csv = toCsv(
    [
      ...report.rows.map((r) => ({
        purchase_date: r.purchase_date,
        customer_name: r.customer_name ?? "",
        customer_phone: r.customer_phone ?? "",
        customer_id_card: r.customer_id_card ?? "",
        customer_tax_code: r.customer_tax_code ?? "",
        product_name: r.product_name,
        category_name: r.category_name,
        purity: r.purity ?? "",
        quantity: r.quantity,
        weight: r.weight ?? "",
        weight_unit: r.weight_unit ?? "",
        weight_chi: r.weight_chi ?? "",
        unit_price: r.unit_price,
        total_amount: r.total_amount,
        is_tax_purchase_input: r.is_tax_purchase_input ? "1" : "0",
        becomes_inventory: r.becomes_inventory ? "1" : "0",
      })),
      {
        purchase_date: "Tổng",
        customer_name: "",
        customer_phone: "",
        customer_id_card: "",
        customer_tax_code: "",
        product_name: "",
        category_name: "",
        purity: "",
        quantity: report.totals.quantity,
        weight: "",
        weight_unit: "",
        weight_chi: report.totals.weight_chi,
        unit_price: "",
        total_amount: report.totals.total_amount,
        is_tax_purchase_input: "",
        becomes_inventory: "",
      },
      {
        purchase_date: "Tổng (Tax)",
        customer_name: "",
        customer_phone: "",
        customer_id_card: "",
        customer_tax_code: "",
        product_name: "",
        category_name: "",
        purity: "",
        quantity: report.taxInputTotals.quantity,
        weight: "",
        weight_unit: "",
        weight_chi: report.taxInputTotals.weight_chi,
        unit_price: "",
        total_amount: report.taxInputTotals.total_amount,
        is_tax_purchase_input: "1",
        becomes_inventory: "",
      },
    ],
    [
      { key: "purchase_date", header: "Ngày mua" },
      { key: "customer_name", header: "Khách" },
      { key: "customer_phone", header: "SĐT" },
      { key: "customer_id_card", header: "CCCD" },
      { key: "customer_tax_code", header: "MST" },
      { key: "product_name", header: "Sản phẩm" },
      { key: "category_name", header: "Nhóm" },
      { key: "purity", header: "Tuổi vàng" },
      { key: "quantity", header: "SL" },
      { key: "weight", header: "Trọng lượng" },
      { key: "weight_unit", header: "Đơn vị" },
      { key: "weight_chi", header: "Trọng lượng (chỉ)" },
      { key: "unit_price", header: "Đơn giá" },
      { key: "total_amount", header: "Tổng tiền" },
      { key: "is_tax_purchase_input", header: "Tax" },
      { key: "becomes_inventory", header: "Vào tồn" },
    ],
    {
      prefixLines: [
        `# Khoảng thời gian: ${range.label}`,
        "# Cột Tax = 1 nghĩa là dòng được tính vào giá mua bình quân (is_tax_purchase_input).",
      ],
    }
  );

  return new NextResponse(csv, {
    headers: csvHeaders(`customer-purchases_${range.from}_${range.to}.csv`),
  });
}
