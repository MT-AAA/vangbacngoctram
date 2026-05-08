import { z } from "zod";

export const inventoryBulkLinkSalesSchema = z.object({
  sale_ids: z.array(z.string().uuid()).min(1),
  inventory_item_id: z.string().uuid(),
  override_manual_cost: z.boolean().default(false),
});
