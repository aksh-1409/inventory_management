import { z } from 'zod';

export const saleSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  customerId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().positive(),
  notes: z.string().optional(),
});
