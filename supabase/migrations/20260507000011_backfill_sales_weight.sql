-- Backfill sales transaction weights from legacy imports.
-- The e-invoice export uses "Số lượng" together with ĐVT. For jewelry rows,
-- that value represents the sold mass in the given unit. Normalize to "chỉ"
-- so tax, inventory linking, and reports use one consistent mass unit.

update public.sales_transactions
set
  weight = case
    when lower(coalesce(unit, 'chỉ')) in ('chỉ', 'chi') then quantity
    when lower(coalesce(unit, '')) in ('lượng', 'luong') then quantity * 10
    when lower(coalesce(unit, '')) in ('gram', 'g') then quantity / 3.75
    else weight
  end,
  weight_unit = case
    when lower(coalesce(unit, 'chỉ')) in ('chỉ', 'chi', 'lượng', 'luong', 'gram', 'g') then 'chỉ'
    else weight_unit
  end
where weight is null
  and quantity is not null
  and lower(coalesce(unit, 'chỉ')) in ('chỉ', 'chi', 'lượng', 'luong', 'gram', 'g');
