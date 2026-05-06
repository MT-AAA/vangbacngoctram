---
name: testing-ngoctram
description: Test the Ngọc Trâm jewelry dashboard end-to-end. Use when verifying signup, Excel sales import, classification, dashboard KPIs, or VAT direct-method tax-period flows.
---

# Testing the Ngọc Trâm dashboard

This app is a Next.js 14 + Supabase dashboard for a Vietnamese jewelry shop. Phase 1 covers auth, dashboard, Excel import with dedupe, and the VAT direct-method tax engine. Phase 1.5 (PR #3) fixed signup auto-sign-in, decimal-safe Excel parsing, and the `Số HĐ` alias. Phase 2A (PR #5) reworked the importer for the real Vietnamese e-invoice export — see "Phase 2A importer" below before testing import flows.

## Devin secrets needed

All four are required (saved at org scope):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` — direct postgres URL (pooler, port 5432). Used for the SQL workarounds below.

The environment-config maintenance script writes `.env.local` from these on session boot.

## How to boot the app

```
npm run dev > /tmp/devserver.log 2>&1 &
sleep 8
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/login   # expect 200
```

The Next.js app expects `.env.local` to be populated. If it isn't, copy from the saved secrets manually.

**Stale-server gotcha:** a previous session's `npm run dev` may already be holding port 3000 from the snapshot, in which case Next.js silently rebinds to 3001. Before booting, run `pkill -f 'next dev'` and verify with `ss -ltnp | grep ':300'`. Otherwise your screenshots will be on port 3001 (still works, but inconsistent across sessions).

**Pitfall:** Do NOT run `npm run build` while `npm run dev` is also running. The build overwrites `.next/` and the dev server then serves stale chunks; you'll see `GET /_next/static/chunks/... 404` in the dev log and the page renders only the giant NT logo decoration with no UI. Recovery: `pkill -f "next dev"; rm -rf .next; npm run dev > /tmp/devserver.log 2>&1 &`. If you need a build to verify CI, run it on a separate worktree or after stopping dev.

## SQL access — `psql` may not be available

The Devin VM does NOT always have `postgresql-client` installed, and `apt-get install` may 404 on the package. When that happens, run SQL via Node + the `pg` package, which the project doesn't depend on but installs cleanly:

```
cd /home/ubuntu/repos/vangbacngoctram
npm i --no-save pg     # adds node_modules/pg without touching package.json
```

…then put the probe script *inside the repo dir* (so Node's ESM resolver finds `node_modules/pg`):

```js
// /home/ubuntu/repos/vangbacngoctram/_devin_probe.mjs
import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
console.log((await c.query('select count(*) from public.sales_transactions')).rows);
await c.end();
```

run with `node _devin_probe.mjs`. Always delete `_devin_*.mjs` before committing — they are session-scratch.

If `psql` *is* available (`which psql` succeeds), prefer it for one-shot queries — it's terser. The existing examples below use `psql` syntax; both are equivalent.

## Auth quirks — two paths to a logged-in admin

The DB trigger `public.handle_new_user()` (in `supabase/migrations/20250506000001_init.sql:416`) fires on every `auth.users` insert. If `profiles` is empty, it:

1. creates a `stores` row using `raw_user_meta_data->>'store_name'` (or default "Cửa hàng của tôi"),
2. inserts a `profiles` row with `role='admin'` linked to that store,
3. calls `seed_store_defaults(store_id)` which seeds three product_categories (Vàng ta / Vàng tây / Bạc), classification_rules, and tax_settings.

Subsequent users get `role='staff'` and `store_id=NULL` until an admin assigns them. **The DB reset must include `delete from public.profiles` — leaving a profile row makes the next signup get `role='staff'` instead of admin.**

For automated tests there are two ways to get a logged-in admin user:

### Path A (preferred for test-mode setup) — Supabase admin API

Creates the user pre-confirmed, fires the same trigger, no email-confirm SQL needed:

```js
await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test-XYZ@ngoctram.local',
    password: 'Test1234!',
    email_confirm: true,    // <- skips the confirm step entirely
    user_metadata: { full_name: 'Test User', store_name: 'Test Store' },
  }),
});
```

Then sign in via the UI through Playwright/CDP at `localhost:29229` — the recording starts on `/dashboard`.

### Path B (for testing the actual signup form) — UI signup + email-confirm SQL

Supabase has email confirmation enabled by default on this project. `supabase.auth.signUp()` creates the user, the trigger fires + admin profile + store + categories + classification rules + tax_settings are all seeded, but the call returns no session, so a redirect to `/dashboard` would bounce back to `/login`. As of PR #3 the form handles this gracefully — it shows a toast `"Tạo tài khoản thành công" / "Vui lòng kiểm tra email…"` and switches to sign-in mode. For tests you still need to confirm the email via SQL because the dev environment can't actually click the email link:

```
psql "$SUPABASE_DB_URL" -c \
  "update auth.users set email_confirmed_at = now() where email = 'YOUR_TEST_EMAIL';"
```

**Note:** `confirmed_at` is a generated column — only update `email_confirmed_at`. Trying to update both in one statement aborts the whole transaction.

Path B is the only way to verify the signup-form code path (toast text, mode switch, etc.). Use Path A for everything else — it's faster.

## Phase 2A importer (PR #5)

The real export is the Vietnamese e-invoice "Báo cáo bán hàng chi tiết". The Phase 2A parser handles its specific quirks — when in doubt run the test fixture instead of crafting a synthetic file:

```
npm test
```

uses `node --import tsx --test src/lib/excel/__tests__/parse.test.ts` and verifies the seven acceptance criteria against `src/lib/excel/__tests__/fixtures/2803122425_Bao_cao_ban_hang_chi_tiet_2026-01-01_2026-03-31.xlsx`: 406 lines, 6,919,680,000 VND total, date range 2026-01-03 → 2026-03-30, 341 unique invoice_keys, 406 unique transaction_hashes, multi-line invoices preserved (e.g. invoice 74 has 2 rows), summary row "Tổng cộng:" skipped.

Key invariants the parser enforces:

- **Header row is dynamic** — scanned in the first 20 rows. The real export has the header at row 8, but never hard-code that.
- **`Sheet1` `!ref` is wrong on the real export** (it covers only the title block). The parser rebuilds the used range by scanning all cell keys; rely on this rather than `decode_range(sheet["!ref"])`.
- **Data rows = numeric STT only.** Title rows, company info, blank rows, and the `Tổng cộng:` summary row are filtered out by checking that `STT` is a number.
- **Vietnamese `dd/MM/yyyy HH:mm`** dates only. `parseInvoiceDate("03/01/2026 16:06") === "2026-01-03T16:06:00"`. If you ever see `2026-03-01` in tests, the parser regressed to US format.
- **Decimal `Số lượng` preserved** (1.5 stays 1.5, never 15). Combine with the PR #3 `raw:true` fix.
- **Two identifiers per row** — never use `invoice_no` alone:
  - `invoice_key = sha256(store_id | invoice_series | invoice_no | tax_authority_code)` — groups multi-line invoices.
  - `transaction_hash = sha256(invoice_key | source_stt | product_name_raw | unit | quantity | unit_price | total_amount)` — per-line dedupe key.
  See `src/lib/excel/hash.ts` for `invoiceKey()` / `transactionHash()` / `rowIdentifiers()`.
- **VAT direct method**: `Thuế GTGT đầu ra VNĐ` is stored verbatim in `vat_output_amount_from_invoice` for reconciliation only. It is **not** VAT payable. Imported rows have `purchase_cost_amount = null` + `purchase_cost_source = 'unknown'`; the existing `compute_sales_value_added` trigger sets `tax_calculation_status = 'missing_purchase_cost'` automatically. Don't try to fill VAT payable from the invoice.
- **Columns from `AY` onwards** (xăng/dầu telemetry) are intentionally ignored.

`import_files` now stores `period_start`, `period_end`, `transaction_line_count`, `unique_invoice_count`, `total_amount`. The `/import` page shows these per row in the history table.

For end-to-end testing of the Phase 2A flow, the golden path is: Path-A signup → upload `src/lib/excel/__tests__/fixtures/2803122425_Bao_cao_ban_hang_chi_tiet_2026-01-01_2026-03-31.xlsx` → preview should show **406 / 341 / 406 / 6.919.680.000 ₫ / 03/01/2026 → 30/03/2026** → commit (Mới=406) → re-upload (Mới=0, Cập nhật=406) → on `/sales`, filter to 04/02/2026 to see invoice 74 as 2 distinct rows, and to 22/03/2026 to see the three spec-mandated unclassified rows (Vàng / Lắc tay / Bông tai vàng) plus contrast cases (Bông tây, Lắc tay vàng tây 10K) that *are* classified.

Uploading the fixture via the UI: the `/import` page has a real `<input type="file">`, so use Playwright's `page.setInputFiles('input[type=file]', fixturePath)` over CDP at `localhost:29229` — file pickers via raw computer-use clicks are flaky.

## Classification matching

`src/lib/classification.ts` uses **whole-word regex** on the lowercased + NFC-normalized product name. There is no diacritic-stripped fallback, because that turns the standalone keyword `tây` into a false positive against `Lắc tay`. Stripped variants (`vang tay`, `vang ta`, `bac`) must be seeded explicitly — `seed_store_defaults` already includes them.

Spec invariants the classifier MUST satisfy (covered by `parse.test.ts`):

- `Vàng`, `Lắc tay`, `Bông tai vàng` → unclassified ("Cần xử lý").
- `Dây chuyền vàng tây 10k`, `Vòng vàng ta 24k`, `Lắc bạc thái` → matched to the right category.

## Excel column aliases (parse.ts)

For Phase 2A's e-invoice flow these are the canonical Vietnamese headers (case-insensitive, whitespace-collapsed). Use the canonical form; ASCII-stripped fallbacks are also accepted where shown.

| Field | Aliases |
|---|---|
| invoice_template_code | ký hiệu mẫu hóa đơn / ky hieu mau hoa don |
| invoice_series | ký hiệu hóa đơn / ky hieu hoa don |
| invoice_no | số hóa đơn / so hoa don / **số hđ, so hd** *(PR #3)* / invoice |
| invoice_date (→ sale_date) | ngày, tháng, năm lập hóa đơn / ngày lập hóa đơn / ngày |
| customer_name | tên khách hàng / khách hàng |
| customer_tax_code | mã số thuế / ma so thue |
| customer_address | địa chỉ / dia chi |
| product_code | mã hàng hóa / ma hang hoa |
| product_name_raw | tên hàng hóa / ten hang hoa / tên hàng / sản phẩm / diễn giải |
| unit | đvt / dvt / đơn vị tính |
| quantity | số lượng / so luong / qty / sl |
| unit_price | đơn giá / don gia / unit price |
| sales_amount_before_tax | doanh số bán hàng chưa thuế vnđ |
| vat_output_amount_from_invoice | thuế gtgt đầu ra vnđ |
| total_amount | tổng cộng vnđ / thành tiền / tổng tiền / total |
| currency | đơn vị tiền tệ |
| currency_rate | tỷ giá |
| payment_method | phương thức thanh toán (fallback: hình thức thanh toán) |
| payment_status | trạng thái thanh toán |
| invoice_status | trạng thái hóa đơn |
| tax_authority_status | trạng thái gửi cqt |
| tax_authority_code | mã cqt cấp |
| source_stt / source_row_number | populated from STT cell + Excel row index |

`weight` is no longer a parser-side field — gold/silver weight comes from `unit` (`chỉ`, `lượng`, etc.) plus `quantity`. The DB column still exists but Phase 2A leaves it null.

## Generating a sample sales Excel

The `xlsx` package is in the repo's `node_modules`, so generate from a script run inside the repo dir (or `cp` the script in first):

```js
// Run with: cd /home/ubuntu/repos/vangbacngoctram && node ./gen-sample-xlsx.js
const XLSX = require('xlsx');
// Use 'Số HĐ' (post PR #3) and decimal weights to *prove* fixes #2 + #3 are in place.
const headers = ['Ngày', 'Số HĐ', 'Tên sản phẩm', 'Số lượng', 'Trọng lượng',
                 'Đơn giá', 'Thành tiền', 'Giá vốn', 'Khách hàng'];
const rows = [
  ['01/05/2026', 'HD-001', 'Nhẫn vàng 9999', 1, 1.5, 6500000, 9750000, 9000000, 'Khách lẻ A'],
  ['03/05/2026', 'HD-002', 'Dây chuyền vàng 18k', 1, 2.0, 4200000, 8400000, 7600000, 'Khách lẻ B'],
  ['05/05/2026', 'HD-003', 'Lắc bạc thái',     1, 5.0, 1200000, 6000000, 4800000, 'Khách lẻ C'],
  ['07/05/2026', 'HD-004', 'Vòng vàng ta 24k', 1, 3.0, 6500000, 19500000, null,    'Khách lẻ D'],
  ['09/05/2026', 'HD-005', 'Bông tai vàng tây 14k', 2, 0.8, 3800000, 6080000, 5300000, 'Khách lẻ E'],
];
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sales');
XLSX.writeFile(wb, '/tmp/sample-sales-v2.xlsx');
```

**Use decimal weights (`1.5`, `0.8`) to prove the parse fix is still in place.** After PR #3, the preview's `Trọng lượng` column should display `1,5` / `0,8` (Vietnamese decimal comma via vi-VN locale). If you see `15` / `8` instead, fix #2 has regressed.

## Excel parsing foot-guns (history)

- **PR #3** (Phase 1.5): added the `Số HĐ` / `số hđ` alias to `invoice_no`. Before this, the `gen-sample-xlsx.js` example above triggered `Lỗi: Số hóa đơn` for every row.
- **PR #3** (Phase 1.5): two-part fix for decimal `Trọng lượng`:
  1. `XLSX.read(buf, { type: 'buffer', raw: true })` — keeps numeric cells as JS numbers.
  2. The `toNumber()` helper short-circuits when `typeof v === 'number'`, avoiding the lossy `String(v).replace(',', '.')` round-trip that was turning 1.5 into 15.
- **PR #5** (Phase 2A): kept (1) and (2), added the dynamic-header / two-identifier / Vietnamese-date overhaul above.

## Reset script (full)

Use before any signup test to ensure the new user becomes admin and the seed runs from scratch:

```
psql "$SUPABASE_DB_URL" <<'SQL'
delete from public.audit_logs;
delete from public.tax_reports;
delete from public.tax_periods;
delete from public.sales_transactions;
delete from public.import_files;
delete from public.classification_rules;
delete from public.product_categories;
delete from public.tax_settings;
delete from public.profiles;
delete from public.stores;
delete from auth.users;
SQL
```

If `psql` isn't available, paste the same SQL into a Node-pg probe (see "SQL access" above).
