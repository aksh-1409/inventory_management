'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Search, Filter, ChevronDown, ChevronUp, Clock, ShieldAlert } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: { before?: unknown; after?: unknown } | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

const ENTITY_TYPES = [
  'Product',
  'Warehouse',
  'Customer',
  'Supplier',
  'WebhookSubscription',
  'ApiKey',
] as const;
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'] as const;

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    CREATE: { bg: 'rgba(17,255,153,0.12)', color: 'var(--success)' },
    UPDATE: { bg: 'rgba(59,158,255,0.12)', color: 'var(--accent)' },
    DELETE: { bg: 'rgba(255,32,71,0.12)', color: 'var(--danger)' },
    RESTORE: { bg: 'rgba(255,197,61,0.12)', color: 'var(--warning)' },
  };
  const s = colors[action] || { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' };
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {action}
    </span>
  );
}

export default function AuditLogPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    search: '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.action) params.set('action', filters.action);
      if (filters.search) params.set('entityId', filters.search);

      const res = await fetch(`/api/v1/audit-logs?${params}`);
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access denied. Admin only.');
        throw new Error('Failed to load audit logs');
      }
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    if (!session) return;
    if (!isAdmin) {
      redirect('/dashboard');
      return;
    }
    fetchLogs();
  }, [fetchLogs, session, isAdmin]);

  if (!session) return null;
  if (!isAdmin) return null;

  return (
    <div className="page-wrapper">
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
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-heading)' }}>Audit Log</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            Immutable record of all changes across the system
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          <Clock style={{ width: 14, height: 14 }} />
          <span>{total} entries</span>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: 200, flex: 1 }}>
            <Search
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 14,
                height: 14,
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="input"
              placeholder="Search by entity ID..."
              value={filters.search}
              onChange={(e) => {
                setFilters((f) => ({ ...f, search: e.target.value }));
                setPage(1);
              }}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select
            className="input"
            style={{ width: 'auto', minWidth: 140 }}
            value={filters.entityType}
            onChange={(e) => {
              setFilters((f) => ({ ...f, entityType: e.target.value }));
              setPage(1);
            }}
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: 'auto', minWidth: 120 }}
            value={filters.action}
            onChange={(e) => {
              setFilters((f) => ({ ...f, action: e.target.value }));
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchLogs} />
      ) : loading ? (
        <div className="card" style={{ padding: 24 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <ShieldAlert
            style={{ width: 32, height: 32, color: 'var(--text-muted)', margin: '0 auto 12px' }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No audit log entries found</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Timestamp
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  User
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Entity
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Action
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td
                    data-label="Timestamp"
                    style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}
                  >
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td data-label="User" style={{ padding: '12px 16px', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-heading)', fontWeight: 500 }}>
                      {entry.user.name || entry.user.email}
                    </span>
                  </td>
                  <td data-label="Entity" style={{ padding: '12px 16px', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{entry.entityType}</span>
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: 11,
                        marginLeft: 8,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {entry.entityId.slice(0, 8)}...
                    </span>
                  </td>
                  <td data-label="Action" style={{ padding: '12px 16px' }}>
                    <ActionBadge action={entry.action} />
                  </td>
                  <td data-label="Details" style={{ padding: '12px 16px' }}>
                    {entry.changes ? (
                      <button
                        onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--accent)',
                          fontSize: 13,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        aria-label={expandedId === entry.id ? 'Hide changes' : 'Show changes'}
                      >
                        {expandedId === entry.id ? (
                          <ChevronUp style={{ width: 14, height: 14 }} />
                        ) : (
                          <ChevronDown style={{ width: 14, height: 14 }} />
                        )}
                        {expandedId === entry.id ? 'Hide' : 'View changes'}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                    {expandedId === entry.id && entry.changes && (
                      <pre
                        style={{
                          marginTop: 8,
                          padding: 12,
                          background: 'var(--bg-surface-deep)',
                          borderRadius: 8,
                          fontSize: 11,
                          overflowX: 'auto',
                          maxHeight: 300,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {JSON.stringify(entry.changes, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <PaginationBar page={page} total={total} pageSize={pageSize} />
          </div>
        </div>
      )}
    </div>
  );
}
