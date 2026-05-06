import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSalesExcel } from "@/lib/excel/parse";
import { transactionHash } from "@/lib/excel/hash";
import {
  classifyProduct,
  type ClassificationRule,
} from "@/lib/classification";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toJson<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, store_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.store_id)
    return NextResponse.json({ error: "Tài khoản chưa được gán cửa hàng" }, { status: 400 });
  if (!["admin", "staff"].includes(profile.role))
    return NextResponse.json({ error: "Bạn không có quyền nhập dữ liệu" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Thiếu file" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const parsed = await parseSalesExcel(arrayBuffer);

  const admin = createAdminClient();

  // Upload original to storage (best-effort)
  const storagePath = `${profile.store_id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  await admin.storage
    .from("imports")
    .upload(storagePath, new Uint8Array(arrayBuffer), {
      contentType:
        file.type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });

  // Create import_files row
  const errorRows = parsed.rows.filter((r) => r.errors.length > 0);
  const goodRows = parsed.rows.filter((r) => r.errors.length === 0);

  const { data: importFile, error: importErr } = await admin
    .from("import_files")
    .insert({
      store_id: profile.store_id,
      file_name: file.name,
      storage_path: storagePath,
      uploaded_by: profile.id,
      status: "processing",
      total_rows: parsed.total_rows,
      error_rows: errorRows.length,
      error_log:
        errorRows.length > 0 ? toJson({ rows: errorRows.slice(0, 100) }) : null,
    })
    .select("*")
    .single();

  if (importErr || !importFile) {
    return NextResponse.json(
      { error: importErr?.message ?? "Không tạo được lịch sử nhập" },
      { status: 500 }
    );
  }

  // Classification rules
  const { data: rules } = await admin
    .from("classification_rules")
    .select("id, category_id, keyword, priority, is_active")
    .eq("store_id", profile.store_id)
    .eq("is_active", true);

  const classificationRules: ClassificationRule[] = (rules ?? []).map((r) => ({
    id: r.id,
    category_id: r.category_id,
    keyword: r.keyword,
    priority: r.priority,
    is_active: r.is_active,
  }));

  // Build rows to upsert (goodRows have already been validated to have sale_date)
  const upsertRows = goodRows
    .filter((r): r is typeof r & { sale_date: string } => !!r.sale_date)
    .map((r) => {
      const hash = transactionHash(r);
      const cls = classifyProduct(r.product_name_raw, classificationRules);
      const purchaseSource: "excel" | "unknown" =
        r.purchase_cost_amount !== null && r.purchase_cost_amount !== undefined
          ? "excel"
          : "unknown";
      return {
        store_id: profile.store_id!,
        import_file_id: importFile.id,
        invoice_no: r.invoice_no,
        transaction_hash: hash,
        sale_date: r.sale_date,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        product_name_raw: r.product_name_raw,
        product_name: r.product_name_raw,
        product_category_id: cls.category_id,
        classification_source: cls.source,
        quantity: r.quantity ?? 1,
        weight: r.weight,
        unit_price: r.unit_price ?? 0,
        total_amount: r.total_amount ?? 0,
        purchase_cost_amount: r.purchase_cost_amount,
        purchase_cost_source: purchaseSource,
        raw_data: toJson(r.raw),
        created_by: profile.id,
      };
    });

  // Determine which hashes already exist (so we can compute inserted vs updated counts).
  // RLS allows current user to read their store's rows.
  const hashes = upsertRows.map((r) => r.transaction_hash);
  let existingCount = 0;
  if (hashes.length > 0) {
    const { data: existing } = await admin
      .from("sales_transactions")
      .select("transaction_hash")
      .eq("store_id", profile.store_id)
      .in("transaction_hash", hashes);
    existingCount = existing?.length ?? 0;
  }

  let insertedCount = 0;
  let upsertError: string | null = null;
  if (upsertRows.length > 0) {
    const { error } = await admin
      .from("sales_transactions")
      .upsert(upsertRows, { onConflict: "store_id,transaction_hash" });
    if (error) {
      upsertError = error.message;
    } else {
      insertedCount = upsertRows.length - existingCount;
    }
  }

  const finalStatus: "completed" | "failed" = upsertError ? "failed" : "completed";

  await admin
    .from("import_files")
    .update({
      status: finalStatus,
      inserted_rows: upsertError ? 0 : insertedCount,
      updated_rows: upsertError ? 0 : existingCount,
      error_rows: errorRows.length + (upsertError ? upsertRows.length : 0),
      error_log: upsertError
        ? toJson({ rows: errorRows.slice(0, 100), upsert_error: upsertError })
        : errorRows.length > 0
          ? toJson({ rows: errorRows.slice(0, 100) })
          : null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", importFile.id);

  // Audit log
  await admin.from("audit_logs").insert({
    store_id: profile.store_id,
    user_id: profile.id,
    action: "import_excel",
    entity_type: "import_files",
    entity_id: importFile.id,
    metadata: {
      file_name: file.name,
      total_rows: parsed.total_rows,
      inserted: upsertError ? 0 : insertedCount,
      updated: upsertError ? 0 : existingCount,
      errors: errorRows.length,
      upsert_error: upsertError ?? null,
    },
  });

  if (upsertError) {
    return NextResponse.json(
      {
        total_rows: parsed.total_rows,
        inserted: 0,
        updated: 0,
        errors: errorRows.length + upsertRows.length,
        import_file_id: importFile.id,
        message: upsertError,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    total_rows: parsed.total_rows,
    inserted: insertedCount,
    updated: existingCount,
    errors: errorRows.length,
    import_file_id: importFile.id,
  });
}
