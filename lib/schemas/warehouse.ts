import { z } from 'zod';

export const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: z.string().optional(),
});

export const warehouseUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional().nullable(),
});
