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
import { findMissingCostPage, listMissingCost } from "@/lib/issues/queries";
import { MissingCostTable } from "@/components/issues/missing-cost-table";

export const dynamic = "force-dynamic";

export default async function MissingCostIssuesPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    include_ignored?: string;
    transactionId?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const includeIgnored = searchParams.include_ignored === "1";
  const requestedPage = Number.parseInt(searchParams.page ?? "0", 10) || 0;

  const transactionId = searchParams.transactionId?.trim() || undefined;

  let resolvedPage = requestedPage;
  let highlightId: string | undefined;
  let highlightMissing = false;

  if (transactionId) {
    const computed = await findMissingCostPage(supabase, {
      transactionId,
      pageSize: 50,
      includeIgnored,
    });
    if (computed === null) {
      // Row exists but is not on this list (maybe already fixed, or ignored
      // when includeIgnored=false). Show a friendly note instead of silently
      // dropping the link.
      highlightId = transactionId;
      highlightMissing = true;
    } else {
      resolvedPage = computed;
      highlightId = transactionId;
    }
  }

  const { rows, total } = await listMissingCost(supabase, {
    page: resolvedPage,
    pageSize: 50,
    includeIgnored,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/issues"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Cần xử lý
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Thiếu giá vốn
            {includeIgnored ? (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                (bao gồm cả đã bỏ qua)
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            Dòng bán hàng chưa có giá vốn (purchase_cost_amount). Thuế GTGT
            trực tiếp cần giá vốn để tính giá trị gia tăng.
          </p>
        </div>
        <Link
          href={
            includeIgnored ? "/issues/missing-cost" : "/issues/missing-cost?include_ignored=1"
          }
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {includeIgnored ? "Chỉ xem dòng cần xử lý" : "Xem cả dòng đã bỏ qua"}
        </Link>
      </div>

      {highlightMissing ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">
              Giao dịch không còn trong danh sách thiếu giá vốn
            </CardTitle>
            <CardDescription className="text-amber-900/80">
              Có thể giao dịch đã được nhập giá vốn, được đánh dấu bỏ qua, hoặc
              đã được gắn với tồn kho. Vui lòng kiểm tra lại trên trang Bán
              hàng.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Không còn dòng nào thiếu giá vốn</CardTitle>
            <CardDescription>
              {includeIgnored
                ? "Cũng không có dòng nào được đánh dấu bỏ qua."
                : "Tất cả dòng bán hàng đã có giá vốn hoặc được đánh dấu bỏ qua."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{total.toLocaleString("vi-VN")} dòng cần xử lý</CardTitle>
            <CardDescription>
              Chọn các dòng cần thao tác hàng loạt, sau đó nhập giá vốn hoặc
              đánh dấu bỏ qua. Mỗi thao tác đều được ghi vào nhật ký hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MissingCostTable
              rows={rows}
              total={total}
              page={resolvedPage}
              pageSize={50}
              includeIgnored={includeIgnored}
              highlightId={highlightId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
