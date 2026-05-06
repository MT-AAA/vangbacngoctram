---
name: testing-ngoctram
description: Test the Ngọc Trâm jewelry dashboard end-to-end. Use when verifying signup, Excel sales import, classification, dashboard KPIs, or VAT direct-method tax-period flows.
---

# Testing the Ngọc Trâm dashboard

This app is a Next.js 14 + Supabase dashboard for a Vietnamese jewelry shop. Phase 1 covers auth, dashboard, Excel import with dedupe, and the VAT direct-method tax engine. Phase 1.5 (PR #3) fixed signup auto-sign-in, decimal-safe Excel parsing, and the `Số HĐ` alias.

## Devin secrets needed

All four are required (saved at org scope):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` — direct postgres URL (pooler, port 5432). Used for the `psql` workarounds below.

The environment-config maintenance script writes `.env.local` from these on session boot.

## How to boot the app

```
npm run dev > /tmp/devserver.log 2>&1 &
sleep 8
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/login   # expect 200
```

The Next.js app expects `.env.local` to be populated. If it isn't, copy from the saved secrets manually.

**Pitfall:** Do NOT run `npm run build` while `npm run dev` is also running. The build overwrites `.next/` and the dev server then serves stale chunks; you'll see `GET /_next/static/chunks/... 404` in the dev log and the page renders only the giant NT logo decoration with no UI. Recovery: `pkill -f "next dev"; rm -rf .next; npm run dev > /tmp/devserver.log 2>&1 &`. If you need a build to verify CI, run it on a separate worktree or after stopping dev.

## Auth quirk — signup does NOT auto-sign-in

Supabase has email confirmation enabled by default on this project. `supabase.auth.signUp()` creates the user + DB trigger fires + admin profile + store + categories + classification rules + tax_settings are all seeded, but the call returns no session, so a redirect to `/dashboard` would bounce back to `/login`.

As of PR #3 the form handles this gracefully — it shows a toast `"Tạo tài khoản thành công" / "Vui lòng kiểm tra email…"` and switches to sign-in mode. For tests you still need to confirm the email via SQL because the dev environment can't actually click the email link:

```
psql "$SUPABASE_DB_URL" -c "update auth.users set email_confirmed_at = now() where email = 'YOUR_TEST_EMAIL';"
```

Note: `confirmed_at` is a generated column — only update `email_confirmed_at`. Trying to update both in one statement aborts the whole transaction.

## How the first user becomes admin

The DB trigger `public.handle_new_user()` (in `supabase/migrations/20250506000001_init.sql:416`) fires on every `auth.users` insert. If `profiles` is empty, it:

1. creates a `stores` row using `raw_user_meta_data->>'store_name'` (or default "Cửa hàng của tôi"),
2. inserts a `profiles` row with `role='admin'` linked to that store,
3. calls `seed_store_defaults(store_id)` which seeds three product_categories (Vàng ta / Vàng tây / Bạc), classification_rules, and tax_settings.

Subsequent users get `role='staff'` and `store_id=NULL` until an admin assigns them.

**This is why the DB reset must include `delete from public.profiles` — leaving a profile row makes the next signup get `role='staff'` instead of admin.**

## Excel column aliases (parse.ts)

The import accepts these Vietnamese / English headers (case-insensitive). When generating sample files, use any of them:

| Field | Aliases |
|---|---|
| sale_date | ngày, ngay, ngày bán, date, sale date |
| invoice_no | số hóa đơn, so hoa don, hóa đơn, hoa don, mã, ma, invoice, invoice no, **số hđ, so hd, số hd, hđ, hd** *(added in PR #3)* |
| product_name_raw | tên hàng, ten hang, sản phẩm, san pham, tên sản phẩm, diễn giải, product, name |
| quantity | số lượng, so luong, qty, sl |
| weight | trọng lượng, trong luong, khối lượng, kl, chỉ, chi |
| unit_price | đơn giá, don gia, giá bán, gia ban, đơn giá bán, unit price |
| total_amount | thành tiền, thanh tien, tổng tiền, tong tien, tổng cộng, total |
| purchase_cost_amount | giá mua vào, gia mua vao, giá vốn, gia von, giá nhập, gia nhap, purchase cost, cost |
| customer_name | khách hàng, khach hang, customer, tên khách |
| customer_phone | số điện thoại, so dien thoai, điện thoại, dien thoai, phone |

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

The decimal bug had **two root causes** — both have to be fixed for it to work:

1. `parseVietnameseNumber` strips `.` even when given a JS number, because the caller wraps everything in `String(v)`. **Fix:** introduce a `toNumber()` helper that short-circuits when `typeof v === 'number'`. Done in PR #3 commit 1.
2. `XLSX.utils.sheet_to_json(sheet, { raw: false, … })` makes SheetJS return *formatted strings* (`"1.5"`) for numeric cells, which means the number short-circuit is unreachable. **Fix:** use `raw: true`. `excelDateToISO` already handles both `Date` objects (from `cellDates: true`) and Excel serial numbers, so dates stay correct. Done in PR #3 commit 2 (post-test).

If you see decimal weights stripped to integers in a future PR, check both points before assuming a different bug.

## Classification keyword priorities (for sample data)

Lowest priority wins (most specific keyword):

- 10: `bạc` / `bac` → Bạc
- 20: `18k`, `14k`, `10k`, `vàng tây`, `vang tay` → Vàng tây
- 25: `tây` → Vàng tây (lower priority — fires after 18k/14k)
- 30: `9999`, `999`, `24k`, `vàng ta`, `vang ta` → Vàng ta

Product names containing "vàng tây" should test the `tây` priority case to make sure it doesn't get classified as Vàng ta when only the standalone `tây` keyword would match.

## Resetting the test database

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

Deleting from `auth.users` cascades to `profiles` via the foreign key, but explicit ordering above keeps the script idempotent if cascades are disabled.

**Verify the reset:**
```
psql "$SUPABASE_DB_URL" -c "select (select count(*) from auth.users) as users, (select count(*) from public.profiles) as profiles, (select count(*) from public.stores) as stores;"
```

All three should be `0`. If `users=0` but `profiles>0`, the next signup will hit a unique-constraint error.

## Clearing browser session between test runs

If you need to log out a previously authenticated user from the browser (e.g. to retest signup), the computer-use `console` action sometimes fails with `"Chrome is not in the foreground"` even when Chrome is visibly the active window. Workarounds in order of preference:

1. Just navigate to `/login` from the URL bar — the middleware will let you re-authenticate even with stale cookies.
2. The sign-out endpoint is POST-only, so navigating directly to `/auth/sign-out` returns 405. Don't bother.
3. If you really need to clear cookies, use Playwright via the Chrome DevTools Protocol at `http://localhost:29229` (it's exposed by the Devin browser session). Install `playwright` first if not already in the project, then `await context.clearCookies()`.

## Golden-path test order

1. Reset DB (above) so the first signup hits the admin-promotion branch.
2. Boot dev server. Do NOT run `npm run build` after this.
3. Sign up at `/login` (form is the same component, just toggled into signup mode).
4. Verify the new toast wording: title `"Tạo tài khoản thành công"`, description `"Vui lòng kiểm tra email…"`, form auto-switches to sign-in mode, password cleared.
5. Run the SQL email-confirm workaround.
6. Sign in with the same credentials (form is already in signin mode).
7. Verify dashboard loads with luxury theme + role chip "Quản trị viên".
8. `/import` → upload sample (with `Số HĐ` header + decimal weights) → preview → commit. Then upload again to verify dedupe (`Mới=0, Cập nhật=N`).
9. `/sales` → confirm rows with decimals shown as `1,5` / `0,8` + missing-cost row marked "Thiếu giá vốn".
10. `/tax-reports` → create monthly period for the test month → confirm VAT numbers.
11. Back to `/dashboard` → confirm bar chart shows the new period.

## Recording tips

- Maximize Chrome before recording: `wmctrl -r "Google Chrome" -b add,maximized_vert,maximized_horz`. Avoid `xdotool key super+Up` (tiles to half-screen on Plasma).
- Native file picker: click the file input, then in the dialog use `Ctrl+L` to open a path entry, type the absolute path, press Enter, then click Open. Or just navigate `/tmp` in the picker.
- Annotate setup steps (signup, email-confirm SQL) as `type=setup`, then use one `test_start`/`assertion` pair per of the golden-path tests.
- If a test discovers a bug and you fix it mid-recording, annotate the fix as a `setup` step with a clear description so the viewer understands why the next preview looks different.

## What's stubbed for Phase 2 (don't try to test these)

Sidebar links `/categories`, `/customer-purchases`, `/inventory`, `/reports`, `/audit-logs`, `/settings` exist but are placeholder pages. Phase 2 will fill them in.
