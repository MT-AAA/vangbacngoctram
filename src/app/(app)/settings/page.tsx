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
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
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

  if (!profile || profile.role !== "admin") {
    return (
      <div className="rounded-md border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Chỉ quản trị viên mới truy cập được Cài đặt.
        </p>
      </div>
    );
  }

  const [
    { data: store },
    { data: settings },
    { data: members },
  ] = await Promise.all([
    supabase.from("stores").select("*").eq("id", profile.store_id!).maybeSingle(),
    supabase.from("tax_settings").select("*").eq("store_id", profile.store_id!).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, created_at")
      .eq("store_id", profile.store_id!)
      .order("created_at"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt</h1>
        <p className="text-sm text-muted-foreground">
          Thông tin cửa hàng, cấu hình thuế và danh sách người dùng.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cửa hàng</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            <strong>Tên:</strong> {store?.name ?? "—"}
          </p>
          <p>
            <strong>Mã số thuế:</strong> {store?.tax_code ?? "Chưa cập nhật"}
          </p>
          <p>
            <strong>Địa chỉ:</strong> {store?.address ?? "Chưa cập nhật"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cài đặt thuế GTGT</CardTitle>
          <CardDescription>
            Phương pháp tính thuế áp dụng cho mua bán vàng, bạc, đá quý.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            <strong>Phương pháp:</strong>{" "}
            {settings?.method === "direct_value_added"
              ? "Trực tiếp trên giá trị gia tăng"
              : settings?.method ?? "—"}
          </p>
          <p>
            <strong>Thuế suất mặc định:</strong> {settings?.vat_rate ?? "—"}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Người dùng trong cửa hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.full_name ?? "—"}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {m.role === "admin"
                        ? "Quản trị"
                        : m.role === "staff"
                        ? "Nhân viên"
                        : "Xem"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.is_active ? "success" : "secondary"}>
                      {m.is_active ? "Hoạt động" : "Vô hiệu"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
