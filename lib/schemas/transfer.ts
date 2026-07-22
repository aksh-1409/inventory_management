import { z } from 'zod'

export const transferRequestSchema = z.object({
  productId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
})

export const transferAcceptSchema = z.object({
  fromWarehouseId: z.string().min(1),
})

export const transferShipSchema = z.object({
  trackingNumber: z.string().optional(),
})

export const transferReceiveSchema = z.object({
  quantityReceived: z.number().int().positive(),
  damagedQuantity: z.number().int().min(0).optional(),
  notes: z.string().optional(),
})
