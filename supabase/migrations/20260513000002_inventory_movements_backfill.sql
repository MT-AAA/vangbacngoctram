-- Backfill inventory movements for existing customer purchases and linked sales.

insert into public.inventory_movements (
  store_id,
  product_category_id,
  inventory_item_id,
  source_type,
  source_id,
  source_label,
  movement_date,
  weight_delta,
  quantity_delta,
  cost_delta,
  unit_cost,
  note,
  created_by
)
select
  cp.store_id,
  cp.product_category_id,
  cp.inventory_item_id,
  'customer_purchase',
  cp.id,
  cp.product_name,
  cp.purchase_date,
  coalesce(cp.weight, cp.quantity, 0),
  coalesce(cp.quantity, cp.weight, 0),
  coalesce(cp.total_amount, 0),
  coalesce(cp.unit_price, 0),
  cp.notes,
  cp.created_by
from public.customer_purchases cp
where cp.becomes_inventory = true
  and cp.product_category_id is not null
on conflict (store_id, source_type, source_id) do update
set
  product_category_id = excluded.product_category_id,
  inventory_item_id = excluded.inventory_item_id,
  source_label = excluded.source_label,
  movement_date = excluded.movement_date,
  weight_delta = excluded.weight_delta,
  quantity_delta = excluded.quantity_delta,
  cost_delta = excluded.cost_delta,
  unit_cost = excluded.unit_cost,
  note = excluded.note,
  created_by = excluded.created_by;

insert into public.inventory_movements (
  store_id,
  product_category_id,
  inventory_item_id,
  source_type,
  source_id,
  source_label,
  movement_date,
  weight_delta,
  quantity_delta,
  cost_delta,
  unit_cost,
  note,
  created_by
)
select
  st.store_id,
  st.product_category_id,
  st.linked_inventory_item_id,
  'sale',
  st.id,
  coalesce(st.product_name, st.product_name_raw, st.invoice_no, st.id::text),
  st.sale_date,
  -abs(coalesce(st.weight, st.quantity, 0)),
  -abs(coalesce(st.quantity, st.weight, 0)),
  -abs(coalesce(st.purchase_cost_amount, 0)),
  case
    when coalesce(st.weight, st.quantity, 0) > 0
      then coalesce(st.purchase_cost_amount, 0) / coalesce(st.weight, st.quantity, 0)
    else null
  end,
  'Backfill giảm tồn từ giao dịch bán đã gắn tồn kho',
  st.created_by
from public.sales_transactions st
where st.linked_inventory_item_id is not null
  and st.product_category_id is not null
  and st.purchase_cost_source = 'inventory'
on conflict (store_id, source_type, source_id) do update
set
  product_category_id = excluded.product_category_id,
  inventory_item_id = excluded.inventory_item_id,
  source_label = excluded.source_label,
  movement_date = excluded.movement_date,
  weight_delta = excluded.weight_delta,
  quantity_delta = excluded.quantity_delta,
  cost_delta = excluded.cost_delta,
  unit_cost = excluded.unit_cost,
  note = excluded.note,
  created_by = excluded.created_by;
