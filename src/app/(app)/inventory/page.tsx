import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  loadInventoryList,
  loadInventorySummary,
} from "@/lib/inventory/queries";
import { InventoryClient } from "@/components/inventory/inventory-client";
import { InventorySummaryCards } from "@/components/inventory/summary-cards";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: {
    category?: string;
    status?: string;
    source?: string;
    missing_cost?: string;
    low_stock?: string;
    q_sku?: string;
    q_name?: string;
    from?: string;
    to?: string;
    page?: string;
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

  const page = Math.max(0, parseInt(searchParams.page ?? "0", 10) || 0);
  const filters = {
    category: searchParams.category ?? null,
    status: searchParams.status ?? null,
    source: searchParams.source ?? null,
    missing_cost:
      searchParams.missing_cost === "1" || searchParams.missing_cost === "true",
    low_stock:
      searchParams.low_stock === "1" || searchParams.low_stock === "true",
    q_sku: searchParams.q_sku ?? null,
    q_name: searchParams.q_name ?? null,
    from: searchParams.from ?? null,
    to: searchParams.to ?? null,
  };

  const [{ rows, total }, summary, { data: categories }] = await Promise.all([
    loadInventoryList(supabase, {
      ...filters,
      page,
      pageSize: PAGE_SIZE,
    }),
    loadInventorySummary(supabase),
    supabase
      .from("product_categories")
      .select("id, name, code")
      .order("display_order"),
  ]);

  const canEdit = profile.role === "admin" || profile.role === "staff";
  const canArchive = profile.role === "admin";

  return (
    <div className="space-y-6">
      <InventorySummaryCards summary={summary} />
      <Card>
        <CardHeader>
          <CardTitle>Danh sách tồn kho</CardTitle>
          <CardDescription>
            Lọc theo nhóm, trạng thái, nguồn nhập. Mặt hàng dùng làm giá vốn sẽ
            xuất hiện trong picker khi gắn vào giao dịch bán có thuế trực tiếp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InventoryClient
            rows={rows}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            categories={categories ?? []}
            canEdit={canEdit}
            canArchive={canArchive}
            filters={{
              category: searchParams.category ?? "",
              status: searchParams.status ?? "",
              source: searchParams.source ?? "",
              missing_cost: filters.missing_cost,
              low_stock: filters.low_stock,
              q_sku: searchParams.q_sku ?? "",
              q_name: searchParams.q_name ?? "",
              from: searchParams.from ?? "",
              to: searchParams.to ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
