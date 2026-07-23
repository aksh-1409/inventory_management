import { z } from 'zod';

export const createWebhookSchema = z.object({
  eventType: z.enum(['stock.low', 'sale.created', 'transfer.completed']),
  targetUrl: z.string().url(),
  secret: z.string().optional(),
});
