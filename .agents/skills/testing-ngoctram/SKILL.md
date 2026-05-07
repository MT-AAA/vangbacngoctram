---
name: testing-ngoctram
description: Test the Ngọc Trâm jewelry dashboard end-to-end. Use when verifying signup, Excel sales import, classification, dashboard KPIs, customer purchases, dashboard custom date filter, mobile drawer, /settings user management (incl. last-admin protection), help page, or VAT direct-method tax-period flows.
---

# Testing the Ngọc Trâm dashboard

This app is a Next.js 14 + Supabase dashboard for a Vietnamese jewelry shop. Phase 1 covers auth, dashboard, Excel import with dedupe, and the VAT direct-method tax engine. Phase 1.5 (PR #3) fixed signup auto-sign-in, decimal-safe Excel parsing, and the `Số HĐ` alias. Phase 2A (PR #5) reworked the importer for the real Vietnamese e-invoice export — see "Phase 2A importer" below before testing import flows. Phase 2C (PR #8 + decimal-fix PR #9) added `/customer-purchases` — see "Phase 2C customer purchases" below. Phase 3 (PR #14) polished the UX — mobile drawer, dashboard custom date filter, /settings user management with audit logs + last-admin protection, /help page, and VN copy review — see "Phase 3 polish PR" below.

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

If the live project already contains real user accounts you must NOT touch (e.g. the human owner's email), don't reset — instead use Path A below to create an isolated test admin in the same store, and reset its password via the admin API:

```js
await fetch(`${URL_}/auth/v1/admin/users/${USER_ID}`, {
  method: 'PUT',
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'content-type': 'application/json' },
  body: JSON.stringify({ password: 'Devin1234!', email_confirm: true }),
});
```

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

For the **second** account onwards (when a store already exists and you want the new account to live in *that* store rather than the default "Cửa hàng của tôi" the trigger creates), follow up the create with a SQL `update public.profiles set store_id=$1, role=$2 where id=$3` and clean up the stray store the trigger created (`delete from public.stores where id <> $existing and id not in (select store_id from public.profiles where store_id is not null)`). This is the only way to force a non-first user into an existing store.

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

The API routes (`src/app/api/customer-purchases/[id]/route.ts`, `src/app/api/users/[id]/route.ts`, etc.) call `requireMember(supabase, ["admin"])` against `createSupabaseServer()`, which reads cookies via Next.js' Supabase SSR adapter. **Do not** try to forge a Supabase auth cookie from `signInWithPassword`'s `access_token` and POST it via `node fetch` — the cookie envelope shape is internal to `@supabase/ssr` and Next.js middleware silently 200s with the `/login` HTML when it doesn't match (your test will then `FAIL` with a fake 200).

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

## Phase 3 polish PR (PR #14)

This section captures four lessons learned testing the polish PR. They generalize to any future PR that touches mobile UI, the Settings user table, or VN copy on `/api/*` routes.

### Mobile viewport when `wmctrl` / `xdotool` resize is blocked

The testing VM's window manager often refuses to actually resize the Chrome window — `wmctrl -r :ACTIVE: -e 0,0,0,400,820` and `xdotool windowsize $WID 400 820` both no-op (geometry stays 1600x1156). Re-launching Chrome with `--window-size=400,800` is also banned by the system prompt ("There is a Chrome browser already running and focused on the screen. Do NOT try to launch, start, or kill Chrome"). The reliable workflow is Chrome's built-in device-emulation:

```
1. Click on the page area to focus Chrome.
2. Press F12 to open DevTools.
3. Press Ctrl+Shift+D to dock DevTools at the bottom (so the device viewport gets full width).
4. Press Ctrl+Shift+M to toggle the device toolbar ("Responsive" mode).
5. The device-toolbar shows current dimensions at the top of the viewport. If you need a specific width, click the dimensions field and type a value (e.g. 400).
```

While DevTools is open + device toolbar active, the recording will show the DevTools panel at the bottom — that's fine. To go back to desktop, press Ctrl+Shift+M (off device toolbar) then F12 (close DevTools). Tailwind `lg:` breakpoints (1024px) trigger correctly when the device viewport is below that width.

**Don't** pass coordinates outside the device viewport's pixel area when clicking — `coordinate=[510, 400]` is page coordinates relative to the device viewport, not the full Chrome window.

### `/api/*` 401 copy is unreachable via plain logged-out curl

PR #14 replaced English `"Unauthorized"` 401 responses with `"Bạn cần đăng nhập để tiếp tục."` across 7 files (`src/app/api/import/preview`, `…/import/commit`, `…/tax/periods` (+`/[id]/recalc`), `src/lib/inventory/api.ts`, `src/lib/customer-purchases/api.ts`, `src/lib/issues/api.ts`).

A plain logged-out `curl http://localhost:3000/api/import/preview` returns `307 → /login?next=/api/import/preview`, NOT the new VN body. The reason is `src/lib/supabase/middleware.ts` — it redirects every unauthenticated non-public request to `/login` before the route handler runs. The new VN 401 body therefore only fires on the narrow defense-in-depth path where middleware passes (cookie present + valid envelope) but the handler's own `getUser()` finds no user (e.g. session revoked between middleware and handler).

**To verify these strings are wired in, prefer code grep over runtime curl:**

```
rg -n 'Unauthorized' src       # expect: no matches
rg -n 'Bạn cần đăng nhập' src  # expect: 7 hits across api/lib
```

If you really need a runtime test, write a Vitest test that calls the route handler directly with a stubbed `getUser()` returning `null` — don't try to drive it via curl + middleware.

### Last-admin protection (409 LAST_ADMIN_CONFIRMATION_REQUIRED)

`PATCH /api/users/[id]` returns `409 { error, code: "LAST_ADMIN_CONFIRMATION_REQUIRED" }` when the requested change would leave the store with zero active admins. The client (`src/components/settings/user-management.tsx`) catches this and shows a confirmation dialog with title `Xác nhận thay đổi quyền quản trị` and `Hủy` / `Tôi hiểu, tiếp tục` buttons. To trigger this, the count of active admins for the caller's `store_id` must be exactly 1.

Setup pattern (when the store has multiple real admins you don't want to touch):

```js
// Temporarily deactivate other admins so only the test-admin is left active
await c.query("update public.profiles set is_active=false where id in ($1, $2)", [otherAdminId1, otherAdminId2]);
// In the UI, demote the test-admin (self) → 409 + dialog
// Click Hủy → state preserved, no audit log row written
// Restore at end
await c.query("update public.profiles set is_active=true where id in ($1, $2)", [otherAdminId1, otherAdminId2]);
```

The primary admin's row has its `Tạm khóa` button disabled (greyed) but the role dropdown is enabled — it's the path that triggers the 409. Self-deactivate is blocked at the UI level entirely. The audit-log row writes the before/after `role` and `is_active`; verify with `select * from public.audit_logs where entity_type='profile' order by created_at desc limit 1`.

### Settings user table is optimistic-toast

After a successful role change in `/settings`, the success toast appears immediately but the row's role dropdown does NOT update until you reload the page (refresh / re-route). The DB and audit log are written correctly. Don't treat the stale dropdown as a failure — instead, verify with SQL:

```
select role, is_active from public.profiles where id=$1;
```

If future PRs add `router.refresh()` after the PATCH, this gotcha will go away.

### Dashboard custom date filter — anchor on KPI deltas, not just URL

The filter persists in URL params (`?period=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`) but the most adversarial assertion is that the KPI numbers actually change. The fixture has known per-month totals you can verify against:

| Range | `Tổng bán ra` |
|---|---|
| 2026-01 | 1,325,630,000 |
| 2026-02 | 2,465,265,000 |
| 2026-03 | 3,128,785,000 |
| Q1 2026 | 6,919,680,000 |
| Current month (May 2026) | 0 |

Pick two ranges with different totals (e.g. Jan vs March) and assert both URL params AND KPI value change. If the custom range is silently being dropped, the dashboard will fall back to the current month and show `0 ₫` for both.

Validation strings are exact and must match `src/components/dashboard/period-filter.tsx`:
- Empty `Từ ngày` or `Đến ngày` → `Vui lòng chọn cả ngày bắt đầu và ngày kết thúc.`
- `Từ ngày` > `Đến ngày` → `Khoảng ngày không hợp lệ`

The `Đặt lại` button puts the URL back to `?period=month` (default), not `?period=custom&from=…`.

### Help page has 13 sections with stable IDs

`src/app/(app)/help/page.tsx` defines 13 sections with IDs you can anchor to: `tong-quan`, `quy-trinh`, `dashboard`, `import`, `sales`, `customer-purchases`, `inventory`, `categories`, `tax-reports`, `import-history`, `settings`, `faq`, `tax-note`. The TOC links use `<a href="#${id}">` so click navigation updates the URL hash to `…/help#${id}` without a page reload. The exact tax disclaimer in section 13 (id=`tax-note`):

> Phần mềm hỗ trợ tổng hợp dữ liệu và ước tính số thuế theo cấu hình. Số liệu cuối cùng cần được kế toán hoặc người phụ trách thuế kiểm tra trước khi kê khai.

On desktop the TOC is sticky on the left (`lg:sticky lg:top-4`); on mobile the TOC stacks above the content as a single column. No horizontal overflow at 360px.
