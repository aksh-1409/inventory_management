import { z } from 'zod';

export const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  price: z.number().positive('Price must be positive'),
  costPrice: z.number().positive().nullable().optional(),
  reorderPoint: z.number().int().min(0).default(5),
  category: z.string().nullable().optional(),
});

export const productUpdateSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  price: z.number().positive().optional(),
  costPrice: z.number().positive().optional().nullable(),
  reorderPoint: z.number().int().min(0).optional(),
  category: z.string().optional().nullable(),
});
