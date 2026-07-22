import { z } from 'zod'

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required'),
})

export const customerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(1).optional(),
})
