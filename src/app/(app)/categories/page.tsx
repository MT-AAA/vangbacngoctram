import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CategoriesPage() {
  const supabase = createClient();
  const [
    { data: categories },
    { data: rules },
  ] = await Promise.all([
    supabase
      .from("product_categories")
      .select("*")
      .order("display_order"),
    supabase
      .from("classification_rules")
      .select("*, category:product_categories(name, code)")
      .order("priority"),
  ]);

  const rulesByCategory = new Map<string, typeof rules>();
  for (const r of rules ?? []) {
    const arr = rulesByCategory.get(r.category_id) ?? [];
    arr.push(r);
    rulesByCategory.set(r.category_id, arr);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Phân loại sản phẩm</h1>
        <p className="text-sm text-muted-foreground">
          Hệ thống tự động phân loại sản phẩm theo từ khóa khi nhập Excel. Quy
          tắc có độ ưu tiên thấp hơn được áp dụng trước.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nhóm sản phẩm</CardTitle>
          <CardDescription>
            Mặc định gồm 3 nhóm: <strong>Vàng ta</strong>, <strong>Vàng tây</strong>,{" "}
            <strong>Bạc</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên nhóm</TableHead>
                <TableHead className="text-right">Thuế suất GTGT</TableHead>
                <TableHead className="text-right">Số quy tắc</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(categories ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.vat_rate}%</TableCell>
                  <TableCell className="text-right">
                    {rulesByCategory.get(c.id)?.length ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "success" : "secondary"}>
                      {c.is_active ? "Đang dùng" : "Tắt"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quy tắc phân loại theo từ khóa</CardTitle>
          <CardDescription>
            Khi tên sản phẩm chứa từ khóa, sản phẩm sẽ được gán vào nhóm tương
            ứng. So khớp không phân biệt hoa thường và dấu tiếng Việt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Ưu tiên</TableHead>
                <TableHead>Từ khóa</TableHead>
                <TableHead>Phân loại</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rules ?? []).map((r) => {
                const cat = Array.isArray(r.category) ? r.category[0] : r.category;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.priority}</TableCell>
                    <TableCell className="font-medium">{r.keyword}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{cat?.name ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "success" : "outline"}>
                        {r.is_active ? "Đang dùng" : "Tắt"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
