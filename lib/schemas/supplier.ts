import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
});

export const supplierUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
});
