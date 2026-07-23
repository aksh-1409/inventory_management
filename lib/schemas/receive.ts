import { z } from 'zod'

export const receiveSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  supplierId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().positive().optional(),
  notes: z.string().optional(),
})
