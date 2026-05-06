# NGỌC TRÂM — Dashboard Vàng Bạc Đá Quý

Vietnamese web dashboard for a jewelry / gold / silver / gemstone shop. Imports
sales data from Excel, classifies products into **Vàng ta**, **Vàng tây**, **Bạc**,
manages basic inventory and purchase costs, and computes **VAT using the direct
method on value added** with calendar-year negative carry-forward.

## Stack

- Next.js 14 (App Router), TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Postgres, Storage) — RLS-enforced multi-tenant per store
- Recharts for dashboard charts

## Local development

```bash
cp .env.example .env.local
# fill in Supabase credentials
npm install
npm run dev
```

## Database

SQL migrations live in `supabase/migrations/`. Apply them with the Supabase CLI
or paste them into the Supabase SQL editor.

## VAT formula (gold/silver/gemstone)

> Value Added = Total selling payment - Corresponding purchase payment
>
> VAT payable = Positive taxable value added after carry-forward offset × 10%
>
> Negative value added carries forward within the same calendar year only.
