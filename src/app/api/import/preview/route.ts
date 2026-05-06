import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSalesExcel } from "@/lib/excel/parse";
import { classifyProduct, type ClassificationRule } from "@/lib/classification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.store_id)
    return NextResponse.json({ error: "Tài khoản chưa được gán cửa hàng" }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Thiếu file" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const parsed = await parseSalesExcel(arrayBuffer);

  // Load classification rules for the user's store
  const { data: rules } = await supabase
    .from("classification_rules")
    .select("id, category_id, keyword, priority, is_active")
    .eq("store_id", profile.store_id)
    .eq("is_active", true);

  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("store_id", profile.store_id);

  const catNameById = new Map<string, string>();
  for (const c of categories ?? []) catNameById.set(c.id, c.name);

  const classificationRules: ClassificationRule[] = (rules ?? []).map((r) => ({
    id: r.id,
    category_id: r.category_id,
    keyword: r.keyword,
    priority: r.priority,
    is_active: r.is_active,
  }));

  const previewRows = parsed.rows.map((r) => {
    const cls = classifyProduct(r.product_name_raw, classificationRules);
    return {
      ...r,
      classified_category_name: cls.category_id
        ? catNameById.get(cls.category_id) ?? null
        : null,
      matched_keyword: cls.matched_keyword,
    };
  });

  return NextResponse.json({
    rows: previewRows,
    unrecognized_columns: parsed.unrecognized_columns,
    recognized_columns: parsed.recognized_columns,
    total_rows: parsed.total_rows,
  });
}
