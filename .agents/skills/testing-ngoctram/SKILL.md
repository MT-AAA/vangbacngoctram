---
name: testing-ngoctram
description: Test the Ngọc Trâm jewelry dashboard end-to-end. Use when verifying signup, Excel sales import, classification, dashboard KPIs, or VAT direct-method tax-period flows.
---

# Testing the Ngọc Trâm dashboard

This app is a Next.js 14 + Supabase dashboard for a Vietnamese jewelry shop. Phase 1 covers auth, dashboard, Excel import with dedupe, and the VAT direct-method tax engine.

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

## Auth quirk — signup does NOT auto-sign-in

Supabase has email confirmation enabled by default on this project. `supabase.auth.signUp()` creates the user + DB trigger fires + admin profile + store + categories + classification rules + tax_settings are all seeded, but the call returns no session, so `router.push('/dashboard')` bounces back to `/login?next=/dashboard`.

**Workaround for tests:** confirm the email via SQL using the service-role pooler URL, then sign in normally:

```
psql "$SUPABASE_DB_URL" -c "update auth.users set email_confirmed_at = now() where email = 'YOUR_TEST_EMAIL';"
```

Note: `confirmed_at` is a generated column — only update `email_confirmed_at`. Trying to update both in one statement aborts the whole transaction.

Long-term fix is one of:
- disable email confirmation in Supabase Dashboard → Auth → Providers → Email,
- have `login-form.tsx` call `signInWithPassword` after `signUp`,
- show a "check your inbox" screen.

## How the first user becomes admin

The DB trigger `public.handle_new_user()` (in `supabase/migrations/20250506000001_init.sql:416`) fires on every `auth.users` insert. If `profiles` is empty, it:

1. creates a `stores` row using `raw_user_meta_data->>'store_name'` (or default "Cửa hàng của tôi"),
2. inserts a `profiles` row with `role='admin'` linked to that store,
3. calls `seed_store_defaults(store_id)` which seeds three product_categories (Vàng ta / Vàng tây / Bạc), classification_rules, and tax_settings.

Subsequent users get `role='staff'` and `store_id=NULL` until an admin assigns them.

## Excel column aliases (parse.ts)

The import accepts these Vietnamese / English headers (case-insensitive). When generating sample files, use any of them:

| Field | Aliases |
|---|---|
| sale_date | ngày, ngay, ngày bán, date, sale date |
| invoice_no | số hóa đơn, so hoa don, hóa đơn, hoa don, mã, ma, invoice, invoice no |
| product_name_raw | tên hàng, ten hang, sản phẩm, san pham, tên sản phẩm, diễn giải, product, name |
| quantity | số lượng, so luong, qty, sl |
| weight | trọng lượng, trong luong, khối lượng, kl, chỉ, chi |
| unit_price | đơn giá, don gia, giá bán, gia ban, đơn giá bán, unit price |
| total_amount | thành tiền, thanh tien, tổng tiền, tong tien, tổng cộng, total |
| purchase_cost_amount | giá mua vào, gia mua vao, giá vốn, gia von, giá nhập, gia nhap, purchase cost, cost |
| customer_name | khách hàng, khach hang, customer, tên khách |
| customer_phone | số điện thoại, so dien thoai, điện thoại, dien thoai, phone |

**Headers known to be missing (treat as foot-guns):** `Số HĐ`, `So HD`, `HĐ`, `Hd` are common short forms but not in the matcher. They land in "unrecognized columns" and break invoice-based dedupe (hash fallback still works).

## Generating a sample sales Excel

The `xlsx` package is in the repo's `node_modules`, so generate from a script run inside the repo dir (or `cp` the script in first):

```js
// Run with: cd /home/ubuntu/repos/vangbacngoctram && node ./gen-sample-xlsx.js
const XLSX = require('xlsx');
const headers = ['Ngày', 'Số hóa đơn', 'Tên sản phẩm', 'Số lượng', 'Trọng lượng',
                 'Đơn giá', 'Thành tiền', 'Giá vốn', 'Khách hàng'];
const rows = [
  ['01/05/2026', 'HD-001', 'Nhẫn vàng 9999', 1, 1.5, 6500000, 9750000, 9000000, 'Khách lẻ A'],
  ['03/05/2026', 'HD-002', 'Dây chuyền vàng 18k', 1, 2,   4200000, 8400000, 7600000, 'Khách lẻ B'],
  ['05/05/2026', 'HD-003', 'Lắc bạc thái',     1, 5,   1200000, 6000000, 4800000, 'Khách lẻ C'],
  ['07/05/2026', 'HD-004', 'Vòng vàng ta 24k', 1, 3,   6500000, 19500000, null,    'Khách lẻ D'],
  ['09/05/2026', 'HD-005', 'Bông tai vàng tây 14k', 2, 1, 3800000, 6080000, 5300000, 'Khách lẻ E'],
];
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sales');
XLSX.writeFile(wb, '/tmp/sample-sales.xlsx');
```

Use `Số hóa đơn` as the invoice header (not `Số HĐ`) so invoice_no is recognized.

**Avoid decimal weights/prices in Excel.** `parseVietnameseNumber` strips `.` characters even when the cell is already a JS number, because `parse.ts` calls `String(v)` first. `1.5` becomes `15`, `0.8` becomes `8`. Use whole numbers in test data until this is fixed (`String(v)` should be skipped when `typeof v === 'number'`).

## Classification keyword priorities (for sample data)

Lowest priority wins (most specific keyword):

- 10: `bạc` / `bac` → Bạc
- 20: `18k`, `14k`, `10k`, `vàng tây`, `vang tay` → Vàng tây
- 25: `tây` → Vàng tây (lower priority — fires after 18k/14k)
- 30: `9999`, `999`, `24k`, `vàng ta`, `vang ta` → Vàng ta

Product names containing "vàng tây" should test the `tây` priority case to make sure it doesn't get classified as Vàng ta when only the standalone `tây` keyword would match.

## Resetting the test database

```
psql "$SUPABASE_DB_URL" -c "\
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
delete from auth.users;"
```

Deleting from `auth.users` cascades to `profiles` via the foreign key, but explicit ordering above keeps the script idempotent if cascades are disabled.

## Golden-path test order

1. Reset DB (above) so the first signup hits the admin-promotion branch.
2. Boot dev server.
3. Sign up at `/login` (form is the same component, just toggled into signup mode).
4. Run the SQL email-confirm workaround.
5. Click "Đã có tài khoản? Đăng nhập" and sign in with the same credentials.
6. Verify dashboard loads with luxury theme + role chip "Quản trị viên".
7. `/import` → upload sample → preview → commit. Then upload again to verify dedupe.
8. `/sales` → confirm 5 rows + missing-cost row marked "Thiếu giá vốn".
9. `/tax-reports` → create monthly period for the test month → confirm VAT numbers.
10. Back to `/dashboard` → confirm bar chart shows the new period.

## Recording tips

- Maximize Chrome before recording: `wmctrl -ir <chrome-window-id> -b add,maximized_vert,maximized_horz`. The window ID comes from `wmctrl -l`. Avoid `xdotool key super+Up` (tiles to half-screen on Plasma).
- Native file picker: click the file input, then in the dialog use `Ctrl+L` to open a path entry, type the absolute path, press Enter, then click Open.
- Annotate setup steps (signup, email-confirm SQL) as `type=setup`, then use one `test_start`/`assertion` pair per of the four golden-path tests.

## What's stubbed for Phase 2 (don't try to test these)

Sidebar links `/categories`, `/customer-purchases`, `/inventory`, `/reports`, `/audit-logs`, `/settings` exist but are placeholder pages. Phase 2 will fill them in.
