import { z } from 'zod'

export const adjustmentSchema = z.object({
  inventoryItemId: z.string().min(1),
  delta: z.number().int(),
  reason: z.string().min(1, 'Reason is required'),
})
