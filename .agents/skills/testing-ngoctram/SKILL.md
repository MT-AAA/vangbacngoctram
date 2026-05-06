---
name: testing-ngoctram
description: Test the Ngọc Trâm jewelry dashboard end-to-end. Use when verifying signup, Excel sales import, classification, dashboard KPIs, customer purchases, or VAT direct-method tax-period flows.
---

# Testing the Ngọc Trâm dashboard

This app is a Next.js 14 + Supabase dashboard for a Vietnamese jewelry shop. Phase 1 covers auth, dashboard, Excel import with dedupe, and the VAT direct-method tax engine. Phase 1.5 (PR #3) fixed signup auto-sign-in, decimal-safe Excel parsing, and the `Số HĐ` alias. Phase 2A (PR #5) reworked the importer for the real Vietnamese e-invoice export — see "Phase 2A importer" below before testing import flows. Phase 2C (PR #8 + decimal-fix PR #9) added `/customer-purchases` — see "Phase 2C customer purchases" below.

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
import { readFileSync } from 'node:fs';
import pg from 'pg';
// dotenv is NOT installed; load .env.local manually:
const env = readFileSync(new URL('./.env.local', import.meta.url), 'utf8');
for (const l of env.split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, '');
}
const c = new pg.Client({
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

## Role-gate testing — use the real browser session, not a synthetic cookie

The API routes (`src/app/api/customer-purchases/[id]/route.ts`, etc.) call `requireMember(supabase, ["admin"])` against `createSupabaseServer()`, which reads cookies via Next.js' Supabase SSR adapter. **Do not** try to forge a Supabase auth cookie from `signInWithPassword`'s `access_token` and POST it via `node fetch` — the cookie envelope shape is internal to `@supabase/ssr` and Next.js middleware silently 200s with the `/login` HTML when it doesn't match (your test will then `FAIL` with a fake 200).

The reliable pattern: keep the *same* browser session that's already signed in, and toggle the role in the DB. The existing cookie keeps validating; only the role gate changes:

```js
// 1) Demote in the DB:
await c.query("update public.profiles set role='staff' where id=$1", [userId]);

// 2) Drive the fetch from inside the page (cookies attach automatically):
import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://localhost:29229');
const page = browser.contexts()[0].pages()[0];
const result = await page.evaluate(async (id) => {
  const r = await fetch(`/api/customer-purchases/${id}`, { method: 'DELETE' });
  return { status: r.status, body: (await r.text()).slice(0, 400) };
}, purchaseId);

// 3) Re-promote and re-issue to sanity-check the path itself isn't broken:
await c.query("update public.profiles set role='admin' where id=$1", [userId]);
```

Refreshing `/customer-purchases` after the demote also visibly hides admin-only UI (`Lịch sử hệ thống`, `Cài đặt`, the trash icon on each row) — useful for the recording. The header role label flips `Quản trị viên` → `Nhân viên`.

**`computer.console` action gotcha:** the action complains "Chrome is not in the foreground" even when `wmctrl` reports Chrome as active and a `screenshot` succeeds. When that happens, fall back to Playwright/CDP `page.evaluate` as above — it doesn't depend on focus.

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
- `Bông tây` (no `Vàng/Bạc/Vàng ta/Vàng tây/Bạc 925`) → unclassified.
- `Lắc tay vàng tây 10K` → `Vàng tây` (matches `vang tay`).
- `Vàng nhẫn 9999`, `Vàng 9999`, `Nhẫn vàng 18K` → `Vàng tây` (matches `vàng` in keyword list).
- `Bạc 925`, `Vòng bạc` → `Bạc`.

When testing classification, the `/sales` table's `Phân loại` cell shows the classified category badge or `Cần xử lý` (yellow); cross-check `select category_id, category_label from public.sales_transactions where store_id=...` to confirm the DB matches the badge.

## Phase 2C customer purchases (PR #8 + PR #9)

New route `/customer-purchases` (sidebar `Mua từ khách`). Records gold/silver/jewelry the shop buys from individual customers. These rows feed both the inventory snapshot (when `becomes_inventory=true`) and the average-purchase-price input (when `is_tax_purchase_input=true`) consumed by the future VAT engine update.

### Required Vietnamese UI copy (anchor your assertions on these strings)

- Sidebar: `Mua từ khách`
- Page title: `Mua từ khách`. Subtitle: `Ghi nhận giao dịch mua vàng/bạc/đá quý từ khách lẻ. Có thể đưa vào tồn kho và dùng làm đầu vào cho giá vốn bình quân (thuế GTGT trực tiếp).`
- Filter bar: `Từ ngày`, `Đến ngày`, `Phân loại`, `Tên sản phẩm`, `Khách hàng` (free-text against `name | phone | tax_code | id_card`), `Tính giá vốn` (`Tất cả` / `Có tính` / `Không tính`). Apply: `Áp dụng`. Clear: `Xóa bộ lọc`.
- Add button: `+ Thêm giao dịch mua` (top-right of the filter bar).
- Create dialog title: `Thêm giao dịch mua từ khách`. Edit dialog title: `Sửa giao dịch mua`. Save buttons: `Lưu giao dịch` (create) / `Cập nhật` (edit). Cancel: `Hủy`.
- Two checkbox toggles in the dialog: `Tính vào giá mua bình quân` (controls `is_tax_purchase_input`) and `Đưa vào tồn kho` (controls `becomes_inventory`). Both default checked.
- Auto-calc helper text under `Thành tiền`: `Tự tính theo SL × Đơn giá`. Override link: `Khôi phục tự tính`.
- Toasts: `Đã thêm giao dịch mua`, `Đã cập nhật giao dịch mua`, `Đã xóa giao dịch mua`. Failure: `Lưu thất bại`.
- Table columns: `Ngày`, `Khách hàng`, `Sản phẩm`, `Phân loại`, `Tuổi`, `SL`, `Đơn giá`, `Thành tiền`, `Thuế` (`Có tính` / `Không`), `Tồn kho` (`Đã đưa vào` / `Không`), `Thao tác`.
- Delete confirm dialog: `Xóa giao dịch mua?` body includes date, product name, total, then `Hành động này không thể hoàn tác.` Buttons: `Hủy` / `Xóa`.
- Dashboard card: `Mua từ khách trong kỳ` — three tiles: `Tổng mua từ khách`, `Tính vào giá vốn bình quân`, `Cần kiểm tra` (with `Thiếu phân loại` and `Thiếu số tiền` sub-counts).
- `Cần xử lý` page rows added: `X giao dịch mua thiếu phân loại` (deeplinks to `/customer-purchases?category=none`) and `X giao dịch mua thiếu số tiền`.

### DB invariants future tests assert

- `customer_purchases` table has a `customer_purchase_create` / `customer_purchase_update` / `customer_purchase_delete` audit log entry per write — all gated by `requireMember`. Delete is admin-only.
- Bidirectional inventory link: `customer_purchases.inventory_item_id` ↔ `inventory_items.source_customer_purchase_id`. `removeInventoryLink` nulls **both** sides; it does **not** hard-delete the inventory row (it might already be partially sold).
- Toggling `Đưa vào tồn kho` off then back on must produce a **new** `inventory_items` row — `ensureInventoryItemForPurchase` does NOT re-attach the previously-detached row. So the test should expect `inventory_items` count to grow by 1 each toggle-on.
- `purity` is a free-text column; the schema validates it server-side against `["9999", "24K", "18K", "14K", "10K", "925", "other"]`.
- Default page size is 50 rows.

### Decimal-form hydration pitfall (PR #9 root cause)

When you build any new edit dialog that pre-populates a numeric input from a DB row, **do not** write `String(row.quantity)` — for `1.5` that produces `"1.5"`, which `parseVietnameseNumber` (`src/lib/utils.ts`) interprets as `"1.5"` thousands-separator and parses as `15`. Saving without changing the field would silently inflate the value 10×. Use `formatNumberForInput(value, maxFractionDigits)` (also in `src/lib/utils.ts`) which renders Vietnamese-locale strings (`"1,5"`, `"4200000"`) that round-trip losslessly through the parser. The regression test in `src/lib/__tests__/utils.test.ts` pins this behaviour — extend it whenever you add a new numeric form input.

### End-to-end test order (use after a fresh DB reset + Path-A signup)

Follow this exact sequence to keep DB state predictable across tests:

1. **Create**: Vàng tây 18K, customer Nguyễn Văn A, `1,5 chỉ × 4.200.000` → expect `Thành tiền=6300000` auto-calc, `customer_purchases` row, linked `inventory_items` row, `customer_purchase_create` audit, dashboard tile `6.300.000 ₫ / 1 giao dịch` in both `Tổng mua từ khách` and `Tính vào giá vốn bình quân`.
2. **Edit toggle off**: open the row, uncheck `Đưa vào tồn kho`, save with no other change → `customer_purchases.inventory_item_id IS NULL`, `inventory_items.source_customer_purchase_id IS NULL`, **`quantity` STILL `1.5`** (regression check for PR #9).
3. **Edit toggle on**: re-open, re-check, save → new `inventory_items` row, `inventory_items` count is now 2, `customer_purchases.quantity` STILL `1.5`.
4. **Add second row** + **filter**: Bạc miếng test, `is_tax_purchase_input=false`. Verify `?tax_input=1` shows only Vàng tây, `?tax_input=0` shows only Bạc; dashboard `Tính vào giá vốn` excludes Bạc.
5. **Admin DELETE**: trash icon → confirm dialog → row removed → `customer_purchase_delete` audit row.
6. **Role gate (shell)**: demote to staff, refresh — trash icon hidden, role label `Nhân viên`. Drive `fetch('/api/customer-purchases/<id>', {method:'DELETE'})` via Playwright/CDP `page.evaluate` (see "Role-gate testing" above) → expect `403` + `{"error":"Bạn không có quyền thực hiện thao tác này"}`. Re-promote, re-issue → `200 {"ok":true}`.
