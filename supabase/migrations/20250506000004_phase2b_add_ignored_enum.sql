-- ============================================================================
-- Phase 2B: extend tax_calc_status with 'ignored'
--
-- The next migration needs to use the new enum value inside a trigger
-- function. Postgres requires `ALTER TYPE ... ADD VALUE` to be committed
-- before the new value can be referenced, so we add the value here in its
-- own migration and use it in 20250506000005_phase2b_issues.sql.
-- ============================================================================

alter type public.tax_calc_status add value if not exists 'ignored';
