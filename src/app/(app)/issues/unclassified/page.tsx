import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { findUnclassifiedPage, listUnclassified } from "@/lib/issues/queries";
import { UnclassifiedTable } from "@/components/issues/unclassified-table";

export const dynamic = "force-dynamic";

export default async function UnclassifiedIssuesPage({
  searchParams,
}: {
  searchParams: { page?: string; transactionId?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role ?? "viewer";

  const requestedPage = Number.parseInt(searchParams.page ?? "0", 10) || 0;
  const transactionId = searchParams.transactionId?.trim() || undefined;
  let page = requestedPage;
  let highlightId: string | undefined;
  if (transactionId) {
    const computed = await findUnclassifiedPage(supabase, {
      transactionId,
      pageSize: 50,
    });
    if (computed !== null) {
      page = computed;
      highlightId = transactionId;
    }
  }

  const [{ rows, total }, { data: categories }] = await Promise.all([
    listUnclassified(supabase, { page, pageSize: 50 }),
    supabase
      .from("product_categories")
      .select("id, name, code")
      .order("display_order"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/issues"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Cần xử lý
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Sản phẩm chưa phân loại
        </h1>
        <p className="text-sm text-muted-foreground">
          Chọn nhóm sản phẩm cho từng dòng, hoặc tạo quy tắc tự động dựa trên
          tên sản phẩm để áp dụng cho cả các dòng giống tên trong tương lai.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Không còn sản phẩm chưa phân loại</CardTitle>
            <CardDescription>
              Tất cả sản phẩm đã được gán nhóm Vàng ta / Vàng tây / Bạc.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{total.toLocaleString("vi-VN")} dòng cần phân loại</CardTitle>
            <CardDescription>
              Bạn có thể: chọn các dòng → gán nhanh một nhóm; hoặc &quot;Tạo
              quy tắc&quot; để hệ thống tự gán cho mọi dòng có tên giống. Mỗi
              thao tác đều được ghi vào nhật ký hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnclassifiedTable
              rows={rows}
              total={total}
              page={page}
              pageSize={50}
              categories={categories ?? []}
              canCreateRule={role === "admin"}
              highlightId={highlightId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
