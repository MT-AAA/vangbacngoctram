import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, writeAuditLog } from "@/lib/issues/api";
import {
  applyAverageCost,
  previewAverageCostApply,
} from "@/lib/tax/average-cost";
import {
  cascadeRecalculateYear,
  recalculateTaxPeriod,
} from "@/lib/tax/recalculate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tax/periods/[id]/apply-average-cost
 *
 * Returns the preview the UI shows before applying the average-cost fallback:
 * per-category averages, the list of sales rows that would be estimated, and
 * the total estimated cost / value-added impact.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const auth = await requireMember(supabase);
  if (!auth.ok) return auth.response;

  try {
    const preview = await previewAverageCostApply(supabase, {
      storeId: auth.profile.store_id,
      periodId: params.id,
    });
    return NextResponse.json({ preview });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tax/periods/[id]/apply-average-cost
 *
 * Applies the preview: updates the affected sales rows to
 * `purchase_cost_source = 'average'` and the estimated cost. The DB trigger
 * sets `tax_calculation_status = 'estimated'` automatically. Recalculates
 * the period (and cascades within the same calendar year) and writes an
 * audit log entry.
 *
 * Manual / inventory / excel costs are protected — the WHERE clause inside
 * `applyAverageCost` enforces `purchase_cost_amount IS NULL`, so a row that
 * gained a real cost between preview and apply is silently skipped.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const auth = await requireMember(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  try {
    const preview = await previewAverageCostApply(admin, {
      storeId: auth.profile.store_id,
      periodId: params.id,
    });

    if (preview.period.is_locked) {
      return NextResponse.json(
        { error: "Kỳ thuế đã khóa, không thể áp dụng giá bình quân" },
        { status: 400 }
      );
    }

    if (preview.affected_rows.length === 0) {
      return NextResponse.json({
        updated: 0,
        skipped: 0,
        preview,
        report: null,
      });
    }

    const outcome = await applyAverageCost(admin, {
      storeId: auth.profile.store_id,
      periodId: params.id,
      preview,
    });

    const report = await recalculateTaxPeriod({
      storeId: auth.profile.store_id,
      periodId: params.id,
      calculatedBy: auth.profile.id,
    });
    await cascadeRecalculateYear({
      storeId: auth.profile.store_id,
      fromPeriodId: params.id,
      calculatedBy: auth.profile.id,
    });

    await writeAuditLog(admin, {
      store_id: auth.profile.store_id,
      user_id: auth.profile.id,
      action: "apply_average_cost",
      entity_type: "tax_periods",
      entity_id: params.id,
      metadata: {
        period_id: params.id,
        period_name: preview.period.name,
        period_start: preview.period.start_date,
        period_end: preview.period.end_date,
        updated_count: outcome.updated_ids.length,
        skipped_count: outcome.skipped_count,
        total_estimated_cost: preview.totals.total_estimated_cost,
        total_estimated_value_added: preview.totals.total_estimated_value_added,
        categories: preview.categories.map((c) => ({
          category_id: c.category_id,
          category_name: c.category_name,
          total_purchase_amount: c.total_purchase_amount,
          total_purchase_quantity: c.total_purchase_quantity,
          average_purchase_price: c.average_purchase_price,
          source_purchase_count: c.source_purchase_count,
        })),
      },
      diff: {
        updated_ids: outcome.updated_ids,
      },
    });

    return NextResponse.json({
      updated: outcome.updated_ids.length,
      skipped: outcome.skipped_count,
      preview,
      report,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi" },
      { status: 500 }
    );
  }
}
