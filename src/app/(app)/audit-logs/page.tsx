import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";

export default async function AuditLogsPage() {
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
  if (!profile || profile.role !== "admin") {
    return (
      <div className="rounded-md border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Chỉ quản trị viên mới xem được nhật ký hệ thống.
        </p>
      </div>
    );
  }

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*, user:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nhật ký hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Lưu lại các thao tác quan trọng (nhập dữ liệu, tạo/tính kỳ thuế).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>200 sự kiện gần nhất</CardTitle>
          <CardDescription>Từ mới đến cũ</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Người dùng</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Chưa có nhật ký nào.
                  </TableCell>
                </TableRow>
              ) : (
                (logs ?? []).map((l) => {
                  const u = Array.isArray(l.user) ? l.user[0] : l.user;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">
                        {new Date(l.created_at).toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {u?.full_name ?? u?.email ?? "Hệ thống"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{l.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.entity_type}
                        {l.entity_id ? `:${l.entity_id.slice(0, 8)}` : ""}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {l.metadata ? JSON.stringify(l.metadata) : ""}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
