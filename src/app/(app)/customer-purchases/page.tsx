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
  listCustomerPurchases,
  type CustomerPurchaseFilters,
} from "@/lib/customer-purchases/queries";
import { CustomerPurchasesClient } from "@/components/customer-purchases/purchases-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function CustomerPurchasesPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    category?: string;
    q?: string;
    customer?: string;
    tax_input?: string;
    highlighted?: string;
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

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const filters: CustomerPurchaseFilters = {
    from: searchParams.from,
    to: searchParams.to,
    category: searchParams.category,
    q: searchParams.q,
    customer: searchParams.customer,
    taxInput: searchParams.tax_input,
    page,
    pageSize: PAGE_SIZE,
  };

  const [{ rows, total }, { data: categories }] = await Promise.all([
    listCustomerPurchases(supabase, filters),
    supabase
      .from("product_categories")
      .select("id, name, code")
      .order("display_order"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mua từ khách</h1>
        <p className="text-sm text-muted-foreground">
          Ghi nhận giao dịch mua vàng/bạc/đá quý từ khách lẻ. Có thể đưa vào
          tồn kho và dùng làm đầu vào cho giá vốn bình quân (thuế GTGT trực
          tiếp).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách giao dịch mua</CardTitle>
          <CardDescription>
            Lọc theo ngày, khách hàng, phân loại hoặc tên sản phẩm. Thêm /
            sửa / xóa giao dịch trực tiếp tại đây.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerPurchasesClient
            rows={rows}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            categories={categories ?? []}
            role={profile.role}
            filters={{
              from: searchParams.from ?? "",
              to: searchParams.to ?? "",
              category: searchParams.category ?? "",
              q: searchParams.q ?? "",
              customer: searchParams.customer ?? "",
              taxInput: searchParams.tax_input ?? "",
              highlighted: searchParams.highlighted ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
