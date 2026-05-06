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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listNegativeVATPeriods } from "@/lib/issues/queries";
import { formatVND, formatVNDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NegativeVATIssuesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rows = await listNegativeVATPeriods(supabase);

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
          Kỳ thuế GTGT âm
        </h1>
        <p className="text-sm text-muted-foreground">
          Các kỳ tính thuế có giá trị gia tăng âm chuyển sang kỳ sau. Theo
          phương pháp trực tiếp, phần âm này được bù trừ vào kỳ kế tiếp.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Không có kỳ thuế GTGT âm</CardTitle>
            <CardDescription>
              Mọi kỳ đã tính đều có giá trị gia tăng dương hoặc bằng 0.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{rows.length} kỳ có giá trị gia tăng âm</CardTitle>
            <CardDescription>
              Mở Báo cáo thuế để xem chi tiết và tái tính.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kỳ</TableHead>
                  <TableHead>Từ ngày</TableHead>
                  <TableHead>Đến ngày</TableHead>
                  <TableHead className="text-right">Âm chuyển kỳ sau</TableHead>
                  <TableHead className="text-right">Mở</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.tax_period_id}>
                    <TableCell className="font-medium">
                      {r.period_name}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatVNDate(r.start_date)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatVNDate(r.end_date)}
                    </TableCell>
                    <TableCell className="text-right text-rose-700">
                      {formatVND(-r.negative_carried_out)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href="/tax-reports"
                        className="text-xs text-primary underline-offset-4 hover:underline"
                      >
                        Mở
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
