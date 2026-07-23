import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  scopes: z.array(z.string()).min(1, 'At least one scope required'),
  expiresInDays: z.number().int().positive().optional(),
});
