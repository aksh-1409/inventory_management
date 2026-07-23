import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Dispatch a webhook event to all active subscribers of that event type.
 * Fire-and-forget — failures are logged but don't block the caller.
 */
export async function dispatchWebhook(eventType: string, data: Record<string, unknown>) {
  try {
    const subscriptions = await prisma.webhookSubscription.findMany({
      where: { eventType, isActive: true },
    });

    if (subscriptions.length === 0) return;

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (sub.secret) {
            const signature = crypto
              .createHmac('sha256', sub.secret)
              .update(JSON.stringify(payload))
              .digest('hex');
            headers['X-Webhook-Signature'] = `sha256=${signature}`;
          }

          const res = await fetch(sub.targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          });

          await prisma.webhookSubscription.update({
            where: { id: sub.id },
            data: {
              lastTriggeredAt: new Date(),
              retryCount: res.ok ? 0 : { increment: 1 },
            },
          });
        } catch {
          await prisma.webhookSubscription
            .update({
              where: { id: sub.id },
              data: { retryCount: { increment: 1 } },
            })
            .catch(() => {});
        }
      })
    );
  } catch (e) {
    console.error(`[WEBHOOK] dispatch failed for ${eventType}`, e);
  }
}
