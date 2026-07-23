import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

const { findManyMock, updateMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateMock: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { webhookSubscription: { findMany: findManyMock, update: updateMock } },
}));

import { dispatchWebhook } from './webhooks';

describe('dispatchWebhook', () => {
  beforeEach(() => {
    updateMock.mockResolvedValue({});
    vi.stubGlobal('fetch', vi.fn());
  });

  it('delivers signed JSON and resets retries after success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    findManyMock.mockResolvedValue([
      { id: 'sub-1', targetUrl: 'https://example.com/hook', secret: 'secret', retryCount: 2 },
    ]);
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await dispatchWebhook('sale.created', { id: 'sale-1' });

    const payload = JSON.stringify({
      event: 'sale.created',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { id: 'sale-1' },
    });
    const signature = crypto.createHmac('sha256', 'secret').update(payload).digest('hex');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
        },
      })
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ retryCount: 0 }) })
    );
    vi.useRealTimers();
  });

  it('does nothing when there are no subscribers', async () => {
    findManyMock.mockResolvedValue([]);
    await dispatchWebhook('stock.low', {});
    expect(fetch).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('increments retries atomically for HTTP and network failures', async () => {
    findManyMock.mockResolvedValue([
      { id: 'http', targetUrl: 'https://example.com/http', secret: null, retryCount: 3 },
      { id: 'network', targetUrl: 'https://example.com/network', secret: null, retryCount: 5 },
    ]);
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockRejectedValueOnce(new Error('offline'));

    await expect(dispatchWebhook('sale.created', {})).resolves.toBeUndefined();

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'http' },
        data: expect.objectContaining({ retryCount: { increment: 1 } }),
      })
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'network' },
      data: { retryCount: { increment: 1 } },
    });
  });

  it('swallows subscription lookup failures', async () => {
    findManyMock.mockRejectedValue(new Error('database unavailable'));
    await expect(dispatchWebhook('sale.created', {})).resolves.toBeUndefined();
  });
});
