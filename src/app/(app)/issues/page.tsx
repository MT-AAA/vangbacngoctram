import Link from "next/link";
import {
  AlertTriangle,
  Tag,
  Sparkles,
  ArrowDownCircle,
  FileSpreadsheet,
  Copy,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadIssueCounts } from "@/lib/issues/data";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Group = {
  href: string;
  label: string;
  description: string;
  icon: typeof AlertTriangle;
  count: number;
  tone: "destructive" | "warning" | "info";
};

export default async function IssuesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const counts = await loadIssueCounts(supabase);

  const groups: Group[] = [
    {
      href: "/issues/missing-cost",
      label: "Thiếu giá vốn",
      description:
        "Dòng bán hàng chưa có purchase_cost_amount. Cần nhập tay hoặc đánh dấu bỏ qua.",
      icon: AlertTriangle,
      count: counts.missingCost,
      tone: "destructive",
    },
    {
      href: "/issues/unclassified",
      label: "Chưa phân loại",
      description:
        "Sản phẩm chưa thuộc nhóm Vàng ta / Vàng tây / Bạc. Có thể tạo quy tắc từ tên.",
      icon: Tag,
      count: counts.unclassified,
      tone: "warning",
    },
    {
      href: "/issues/estimated",
      label: "Đang tính ước tính",
      description:
        "Giá vốn lấy theo giá mua bình quân từ khách. Có thể thay bằng giá vốn thực khi nhập tay.",
      icon: Sparkles,
      count: counts.estimated,
      tone: "warning",
    },
    {
      href: "/issues/negative-vat",
      label: "Kỳ thuế GTGT âm",
      description:
        "Kỳ tính thuế có giá trị gia tăng âm chuyển sang kỳ sau. Theo dõi để bù trừ.",
      icon: ArrowDownCircle,
      count: counts.negativeVAT,
      tone: "info",
    },
    {
      href: "/issues/reconciliation",
      label: "Đối soát file nhập",
      description:
        "File nhập có dòng lỗi hoặc số dòng commit khớp không khớp với số dòng đọc.",
      icon: FileSpreadsheet,
      count: counts.reconciliationWarnings,
      tone: "info",
    },
    {
      href: "/issues/duplicates",
      label: "Hóa đơn trùng / nghi ngờ",
      description:
        "Cùng dòng sản phẩm trên cùng hóa đơn, hoặc cùng số hóa đơn trên nhiều ký hiệu.",
      icon: Copy,
      count: counts.duplicates,
      tone: "warning",
    },
  ];

  const allClean = counts.total === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cần xử lý</h1>
          <p className="text-sm text-muted-foreground">
            Trang tập trung các vấn đề chất lượng dữ liệu sau khi nhập file
            Excel bán hàng. Sửa từng nhóm để báo cáo thuế GTGT trực tiếp được
            tính chính xác.
          </p>
        </div>
        <Badge variant={allClean ? "success" : "warning"} className="text-sm">
          {allClean
            ? "Không còn vấn đề"
            : `${formatNumber(counts.total, 0)} vấn đề`}
        </Badge>
      </div>

      {allClean && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              Dữ liệu sạch
            </CardTitle>
            <CardDescription>
              Hiện không có nhóm vấn đề nào cần xử lý. Tiếp tục nhập file Excel
              tiếp theo hoặc chạy báo cáo thuế.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <IssueGroupCard key={g.href} group={g} />
        ))}
      </div>

      {counts.ignored > 0 && (
        <p className="text-xs text-muted-foreground">
          Có {formatNumber(counts.ignored, 0)} dòng đã được đánh dấu &quot;Bỏ
          qua có chủ ý&quot;.{" "}
          <Link
            href="/issues/missing-cost?include_ignored=1"
            className="underline"
          >
            Xem danh sách
          </Link>
        </p>
      )}
    </div>
  );
}

function IssueGroupCard({ group }: { group: Group }) {
  const Icon = group.icon;
  const empty = group.count === 0;
  const badgeVariant: "success" | "destructive" | "warning" | "secondary" =
    empty
      ? "success"
      : group.tone === "destructive"
        ? "destructive"
        : group.tone === "warning"
          ? "warning"
          : "secondary";

  return (
    <Link
      href={group.href}
      className="block rounded-lg border bg-card text-card-foreground shadow-sm transition-colors hover:bg-accent/40"
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">{group.label}</h2>
          </div>
          <Badge variant={badgeVariant}>
            {empty ? "0" : formatNumber(group.count, 0)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{group.description}</p>
        <div className="mt-1 inline-flex items-center gap-1 text-sm text-primary">
          {empty ? "Đã xử lý" : "Mở danh sách"}
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}
