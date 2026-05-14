-- Gộp các rổ tồn kho bình quân bị tạo trùng theo từng cửa hàng + nhóm hàng.
-- Giữ lại rổ cũ nhất làm rổ chính, chuyển toàn bộ liên kết sang rổ chính,
-- cộng dồn số lượng/trọng lượng/giá vốn, rồi archive các rổ trùng.

with pool_rows as (
  select
    ii.*,
    pc.code as category_code,
    pc.name as category_name,
    row_number() over (
      partition by ii.store_id, ii.product_category_id
      order by ii.created_at asc, ii.id asc
    ) as rn,
    first_value(ii.id) over (
      partition by ii.store_id, ii.product_category_id
      order by ii.created_at asc, ii.id asc
    ) as keep_id,
    sum(coalesce(ii.current_quantity, ii.quantity_on_hand, 0)) over (
      partition by ii.store_id, ii.product_category_id
    ) as merged_quantity,
    sum(coalesce(ii.current_weight, ii.weight, 0)) over (
      partition by ii.store_id, ii.product_category_id
    ) as merged_weight,
    sum(coalesce(ii.purchase_cost_amount, ii.total_cost, 0)) over (
      partition by ii.store_id, ii.product_category_id
    ) as merged_cost,
    sum(coalesce(ii.initial_quantity, ii.quantity_on_hand, 0)) over (
      partition by ii.store_id, ii.product_category_id
    ) as merged_initial_quantity,
    sum(coalesce(ii.initial_weight, ii.weight, 0)) over (
      partition by ii.store_id, ii.product_category_id
    ) as merged_initial_weight,
    count(*) over (
      partition by ii.store_id, ii.product_category_id
    ) as pool_count
  from public.inventory_items ii
  join public.product_categories pc on pc.id = ii.product_category_id
  where ii.is_tax_cost_source = true
    and ii.name = ('Tồn kho bình quân - ' || pc.name)
    and lower(pc.code) in ('vang_ta', 'vang_tay', 'bac')
    and ii.status <> 'archived'
), keep_rows as (
  select *
  from pool_rows
  where rn = 1 and pool_count > 1
), duplicate_rows as (
  select *
  from pool_rows
  where rn > 1 and pool_count > 1
), update_customer_purchases as (
  update public.customer_purchases cp
  set inventory_item_id = d.keep_id
  from duplicate_rows d
  where cp.inventory_item_id = d.id
  returning cp.id
), update_sales as (
  update public.sales_transactions st
  set linked_inventory_item_id = d.keep_id
  from duplicate_rows d
  where st.linked_inventory_item_id = d.id
  returning st.id
), update_movements as (
  update public.inventory_movements im
  set inventory_item_id = d.keep_id
  from duplicate_rows d
  where im.inventory_item_id = d.id
  returning im.id
), update_keep_rows as (
  update public.inventory_items ii
  set
    name = 'Tồn kho bình quân - ' || k.category_name,
    source_reference = 'POOL-' || upper(regexp_replace(k.category_code, '[^a-zA-Z0-9]+', '-', 'g')),
    quantity_on_hand = k.merged_quantity,
    current_quantity = k.merged_quantity,
    initial_quantity = k.merged_initial_quantity,
    weight = k.merged_weight,
    current_weight = k.merged_weight,
    initial_weight = k.merged_initial_weight,
    total_cost = k.merged_cost,
    purchase_cost_amount = nullif(k.merged_cost, 0),
    unit_cost = case when k.merged_weight > 0 then k.merged_cost / k.merged_weight else ii.unit_cost end,
    purchase_unit_price = case when k.merged_weight > 0 then k.merged_cost / k.merged_weight else ii.purchase_unit_price end,
    status = case when k.merged_quantity > 0 then 'in_stock'::public.inventory_status else ii.status end,
    notes = 'Rổ tồn kho bình quân đã gộp trùng theo nhóm hàng.',
    updated_at = now()
  from keep_rows k
  where ii.id = k.keep_id
  returning ii.id
)
update public.inventory_items ii
set
  status = 'archived'::public.inventory_status,
  current_quantity = 0,
  current_weight = 0,
  quantity_on_hand = 0,
  notes = coalesce(ii.notes, '') || ' | Đã gộp vào rổ bình quân chính.',
  updated_at = now()
from duplicate_rows d
where ii.id = d.id;
