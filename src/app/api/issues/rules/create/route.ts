import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/issues/api";
import { rerunClassification } from "@/lib/issues/reclassify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a new classification rule (`classification_rules`) for this store
 * and optionally re-run classification on rows that currently have no
 * category. Admin-only because rules affect every future import.
 *
 * Body: { keyword: string, category_id: string, priority?: number, reclassify?: boolean }
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await requireMember(supabase, ["admin"]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const b = body as {
    keyword?: unknown;
    category_id?: unknown;
    priority?: unknown;
    reclassify?: unknown;
  };

  const keyword = String(b.keyword ?? "").trim().toLowerCase();
  if (!keyword) {
    return NextResponse.json({ error: "Thiếu từ khóa" }, { status: 400 });
  }
  const categoryId = String(b.category_id ?? "");
  if (!categoryId) {
    return NextResponse.json(
      { error: "Thiếu category_id" },
      { status: 400 }
    );
  }
  const priority = Number.isFinite(Number(b.priority))
    ? Math.trunc(Number(b.priority))
    : 50;
  const reclassify = b.reclassify !== false; // default true

  const admin = createAdminClient();

  const { data: cat } = await admin
    .from("product_categories")
    .select("id, name, code")
    .eq("id", categoryId)
    .eq("store_id", auth.profile.store_id)
    .maybeSingle();
  if (!cat) {
    return NextResponse.json(
      { error: "Nhóm sản phẩm không hợp lệ" },
      { status: 400 }
    );
  }

  // Avoid creating an exact-duplicate rule.
  const { data: existing } = await admin
    .from("classification_rules")
    .select("id, category_id, priority, is_active")
    .eq("store_id", auth.profile.store_id)
    .eq("keyword", keyword)
    .maybeSingle();

  let rule: { id: string; category_id: string; priority: number };
  if (existing) {
    if (existing.category_id !== categoryId || !existing.is_active) {
      const { data: updated, error: updErr } = await admin
        .from("classification_rules")
        .update({
          category_id: categoryId,
          is_active: true,
          priority,
        })
        .eq("id", existing.id)
        .select("id, category_id, priority")
        .single();
      if (updErr || !updated) {
        return NextResponse.json(
          { error: updErr?.message ?? "Không cập nhật được quy tắc" },
          { status: 500 }
        );
      }
      rule = updated;
    } else {
      rule = {
        id: existing.id,
        category_id: existing.category_id,
        priority: existing.priority,
      };
    }
  } else {
    const { data: created, error: insErr } = await admin
      .from("classification_rules")
      .insert({
        store_id: auth.profile.store_id,
        category_id: categoryId,
        keyword,
        priority,
      })
      .select("id, category_id, priority")
      .single();
    if (insErr || !created) {
      return NextResponse.json(
        { error: insErr?.message ?? "Không tạo được quy tắc" },
        { status: 500 }
      );
    }
    rule = created;
  }

  let reclassified = 0;
  if (reclassify) {
    reclassified = await rerunClassification(
      admin,
      auth.profile.store_id,
      "unclassified"
    );
  }

  await writeAuditLog(admin, {
    store_id: auth.profile.store_id,
    user_id: auth.profile.id,
    action: "classification_rule_create",
    entity_type: "classification_rules",
    entity_id: rule.id,
    metadata: {
      keyword,
      category_id: categoryId,
      category_name: cat.name,
      category_code: cat.code,
      priority,
      reclassified,
      reused_existing_rule: Boolean(existing),
    },
  });

  return NextResponse.json({
    rule_id: rule.id,
    reclassified,
  });
}


