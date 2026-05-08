import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSalesExcel } from "@/lib/excel/parse";
import { rowIdentifiers } from "@/lib/excel/hash";
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
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập để tiếp tục." }, { status: 401 });

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
      transaction_line_count: parsed.data_row_count,
      unique_invoice_count: parsed.unique_invoice_count,
      total_amount: parsed.total_amount,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
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

  // Build rows to upsert. Imported rows always start with
  // `tax_calculation_status = 'missing_purchase_cost'` because direct-method
  // VAT requires the purchase cost, which is not in the sales report — the
  // DB trigger `compute_sales_value_added` enforces this when
  // `purchase_cost_amount` is null.
  const upsertRows = goodRows
    .filter((r): r is typeof r & { sale_date: string } => !!r.sale_date)
    .map((r) => {
      const ids = rowIdentifiers(profile.store_id!, r);
      const cls = classifyProduct(r.product_name_raw, classificationRules);
      return {
        store_id: profile.store_id!,
        import_file_id: importFile.id,

        // Invoice identity
        invoice_template_code: r.invoice_template_code,
        invoice_series: r.invoice_series,
        invoice_no: r.invoice_no,
        invoice_key: ids.invoice_key,
        transaction_hash: ids.transaction_hash,
        invoice_date: r.invoice_date,
        sale_date: r.sale_date,

        // Customer
        customer_name: r.customer_name,
        customer_tax_code: r.customer_tax_code,
        customer_address: r.customer_address,

        // Product
        product_code: r.product_code,
        product_name_raw: r.product_name_raw,
        product_name: r.product_name_raw,
        product_category_id: cls.category_id,
        classification_source: cls.source,
        unit: r.unit,
        quantity: r.quantity ?? 1,
        unit_price: r.unit_price ?? 0,
        weight: r.weight,
        weight_unit: r.weight_unit,

        // Amounts
        currency: r.currency,
        currency_rate: r.currency_rate,
        sales_amount_before_tax: r.sales_amount_before_tax,
        vat_output_amount_from_invoice: r.vat_output_amount_from_invoice,
        total_amount: r.total_amount ?? 0,

        // VAT direct method — left null intentionally; tax engine fills these
        // when purchase cost is provided. The trigger sets
        // tax_calculation_status to 'missing_purchase_cost' automatically.
        purchase_cost_amount: null,
        purchase_cost_source: "unknown" as const,

        // Payment + e-invoice status (raw flags from CQT)
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        invoice_status: r.invoice_status,
        tax_authority_status: r.tax_authority_status,
        tax_authority_code: r.tax_authority_code,

        // Provenance
        source_stt: r.source_stt,
        source_row_number: r.source_row_number,
        raw_data: toJson(r.raw),
        created_by: profile.id,
      };
    });

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

  await admin.from("audit_logs").insert({
    store_id: profile.store_id,
    user_id: profile.id,
    action: "import_excel",
    entity_type: "import_files",
    entity_id: importFile.id,
    metadata: {
      file_name: file.name,
      total_rows: parsed.total_rows,
      transaction_line_count: parsed.data_row_count,
      unique_invoice_count: parsed.unique_invoice_count,
      total_amount: parsed.total_amount,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
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
    transaction_line_count: parsed.data_row_count,
    unique_invoice_count: parsed.unique_invoice_count,
    total_amount: parsed.total_amount,
    period_start: parsed.period_start,
    period_end: parsed.period_end,
  });
}
