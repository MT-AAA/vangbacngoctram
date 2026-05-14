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
  Package,
  Boxes,
  Link2,
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
import { loadInventoryIssueCounts } from "@/lib/inventory/issues";
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

  const [counts, inventoryCounts] = await Promise.all([
    loadIssueCounts(supabase),
    loadInventoryIssueCounts(supabase),
  ]);

  const groups: Group[] = [
    {
      href: "/issues/missing-cost",
      label: "Thiếu giá vốn",
      description:
        "Dòng bán hàng chưa có giá mua vào để tính lãi và thuế. Cần gắn với rổ tồn kho hoặc nhập giá vốn thủ công.",
      icon: AlertTriangle,
      count: counts.missingCost,
      tone: "destructive",
    },
    {
      href: "/issues/unclassified",
      label: "Chưa phân loại",
      description:
        "Sản phẩm chưa được xếp vào nhóm Vàng ta / Vàng tây / Bạc. Có thể tạo quy tắc tự động từ tên hàng.",
      icon: Tag,
      count: counts.unclassified,
      tone: "warning",
    },
    {
      href: "/issues/estimated",
      label: "Đang tính ước tính",
      description:
        "Giá vốn đang tạm tính theo giá mua bình quân. Có thể gắn tồn kho hoặc nhập giá đúng nếu cần.",
      icon: Sparkles,
      count: counts.estimated,
      tone: "warning",
    },
    {
      href: "/issues/negative-vat",
      label: "Kỳ thuế GTGT âm",
      description:
        "Kỳ này mua vào lớn hơn bán ra nên phần âm sẽ được chuyển sang kỳ sau để theo dõi.",
      icon: ArrowDownCircle,
      count: counts.negativeVAT,
      tone: "info",
    },
    {
      href: "/issues/reconciliation",
      label: "Đối soát file nhập",
      description:
        "File nhập có dòng lỗi hoặc số dòng đã lưu chưa khớp với số dòng đọc được từ Excel.",
      icon: FileSpreadsheet,
      count: counts.reconciliationWarnings,
      tone: "info",
    },
    {
      href: "/issues/duplicates",
      label: "Hóa đơn trùng / nghi ngờ",
      description:
        "Có dòng sản phẩm hoặc số hóa đơn có dấu hiệu bị nhập trùng. Cần kiểm tra trước khi báo cáo.",
      icon: Copy,
      count: counts.duplicates,
      tone: "warning",
    },
    {
      href: "/inventory?missing_cost=1",
      label: "Tồn thiếu giá mua",
      description:
        "Mặt hàng tồn kho chưa có tổng giá mua vào, nên chưa đủ dữ liệu để làm giá vốn khi bán.",
      icon: Package,
      count: inventoryCounts.missingCost,
      tone: "warning",
    },
    {
      href: "/inventory?category=none",
      label: "Tồn chưa phân loại",
      description:
        "Mặt hàng tồn chưa được gán nhóm Vàng ta / Vàng tây / Bạc.",
      icon: Boxes,
      count: inventoryCounts.missingCategory,
      tone: "warning",
    },
    {
      href: "/inventory?status=adjusted",
      label: "Tồn âm hoặc sai dữ liệu",
      description:
        "Mặt hàng có số lượng hoặc trọng lượng âm. Cần kiểm tra điều chỉnh.",
      icon: AlertTriangle,
      count: inventoryCounts.negativeStock,
      tone: "destructive",
    },
    {
      href: "/issues/missing-cost",
      label: "Bán gắn tồn đã ngưng",
      description:
        "Giao dịch bán đang gắn với mặt hàng tồn đã lưu trữ hoặc đã bán hết.",
      icon: Link2,
      count: inventoryCounts.linkedToArchived,
      tone: "warning",
    },
  ];

  const allClean = counts.total === 0 && inventoryCounts.total === 0;

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
            : `${formatNumber(counts.total + inventoryCounts.total, 0)} vấn đề`}
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
