'use client';

import { useState, useMemo } from 'react';
import { Webhook, Plus, Search, X, Loader2, Trash2, Zap } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';

interface WebhookSub {
  id: string;
  eventType: string;
  targetUrl: string;
  isActive: boolean;
  retryCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface Props {
  initialWebhooks: WebhookSub[];
  total?: number;
  page?: number;
  pageSize?: number;
}

const EVENT_TYPES = [
  { value: 'stock.low', label: 'Stock Low' },
  { value: 'sale.created', label: 'Sale Created' },
  { value: 'transfer.completed', label: 'Transfer Completed' },
];

export default function WebhooksClient({ initialWebhooks }: Props) {
  const { showToast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookSub[]>(initialWebhooks);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    eventType: '',
    targetUrl: '',
    secret: '',
  });

  const filtered = useMemo(() => {
    if (!search) return webhooks;
    const q = search.toLowerCase();
    return webhooks.filter((w) => w.eventType.includes(q) || w.targetUrl.toLowerCase().includes(q));
  }, [webhooks, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.eventType) {
      showToast('Select an event type', 'error');
      return;
    }
    if (!createForm.targetUrl.trim()) {
      showToast('Enter a target URL', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: createForm.eventType,
          targetUrl: createForm.targetUrl,
          secret: createForm.secret || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setWebhooks((prev) => [data.webhook, ...prev]);
      showToast('Webhook created');
      setShowCreateModal(false);
      setCreateForm({ eventType: '', targetUrl: '', secret: '' });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create webhook', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this webhook?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/webhooks/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      showToast('Webhook deleted');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete webhook', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleTest(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/webhooks/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Test event sent');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send test', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Webhooks</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            Receive HTTP callbacks on inventory events
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ gap: 8 }}
        >
          <Plus style={{ width: 16, height: 16 }} />
          Add Webhook
        </button>
      </div>

      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 16,
            height: 16,
            color: 'var(--text-muted)',
          }}
        />
        <input
          type="text"
          placeholder="Search webhooks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ paddingLeft: 36 }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
            aria-label="Clear search"
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {error && filtered.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setWebhooks(initialWebhooks);
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Webhook}
          title="No webhooks"
          description={
            search ? 'Try a different search.' : 'Add a webhook to get notified when events happen.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((w) => (
            <div key={w.id} className="card" style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(99,102,241,0.12)',
                        color: 'var(--accent)',
                        fontSize: 12,
                      }}
                    >
                      {w.eventType}
                    </span>
                    <span
                      className="badge"
                      style={{
                        background: w.isActive ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
                        color: w.isActive ? 'var(--success)' : 'var(--danger)',
                        fontSize: 12,
                      }}
                    >
                      {w.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p
                    className="tabular"
                    style={{
                      fontSize: 14,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {w.targetUrl}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Created {new Date(w.createdAt).toLocaleDateString()}
                    {w.lastTriggeredAt &&
                      ` · Last triggered ${new Date(w.lastTriggeredAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleTest(w.id)}
                    disabled={loading}
                    className="btn btn-ghost"
                    style={{ gap: 4, fontSize: 12, padding: '8px 12px', minHeight: 'auto' }}
                  >
                    <Zap style={{ width: 12, height: 12 }} />
                    Test
                  </button>
                  <button
                    onClick={() => handleDelete(w.id)}
                    disabled={loading}
                    className="btn btn-ghost"
                    style={{
                      gap: 4,
                      color: 'var(--danger)',
                      fontSize: 12,
                      padding: '8px 12px',
                      minHeight: 'auto',
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={() => setShowCreateModal(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
          />
          <div
            className="surface-2"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 480,
              borderRadius: 12,
              border: '1px solid var(--border)',
              padding: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-heading)' }}>
                Add Webhook
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost"
                style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}
                aria-label="Close"
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form
              onSubmit={handleCreate}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  Event Type *
                </label>
                <select
                  value={createForm.eventType}
                  onChange={(e) => setCreateForm({ ...createForm, eventType: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '10px 16px',
                    color: 'var(--text-heading)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Select event...</option>
                  {EVENT_TYPES.map((et) => (
                    <option key={et.value} value={et.value} style={{ background: '#1a1a24' }}>
                      {et.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  Target URL *
                </label>
                <input
                  className="input"
                  type="url"
                  value={createForm.targetUrl}
                  onChange={(e) => setCreateForm({ ...createForm, targetUrl: e.target.value })}
                  placeholder="https://your-server.com/webhook"
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  Secret (optional)
                </label>
                <input
                  className="input"
                  value={createForm.secret}
                  onChange={(e) => setCreateForm({ ...createForm, secret: e.target.value })}
                  placeholder="Used to sign webhook payloads"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Webhook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
