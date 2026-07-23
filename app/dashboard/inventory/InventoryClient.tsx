'use client';

import { useState, useEffect, useOptimistic, useTransition, useCallback } from 'react';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Package, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchInput } from '@/components/ui/SearchInput';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { CursorPagination } from '@/components/ui/CursorPagination';
import { useToast } from '@/components/ui/Toast';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { adjustmentSchema } from '@/lib/schemas';

interface InventoryItem {
  id: string;
  quantity: number;
  damaged: number;
  productId: string;
  warehouseId: string;
  product: { id: string; sku: string; name: string; reorderPoint: number };
  warehouse: { id: string; name: string };
}

interface Props {
  initialItems: InventoryItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
  userRole: string;
}

type OptimisticAction = { type: 'adjust'; id: string; delta: number };

export default function InventoryClient({
  initialItems,
  total,
  page,
  pageSize,
  totalCount,
  nextCursor: initialNextCursor,
  hasMore: initialHasMore,
  userRole,
}: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const cursorMode = initialNextCursor !== undefined;
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null);
  const [hasMore, setHasMore] = useState(initialHasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [optimisticItems, addOptimistic] = useOptimistic(
    items,
    (state, action: OptimisticAction) => {
      if (action.type === 'adjust') {
        return state.map((item) =>
          item.id === action.id ? { ...item, quantity: item.quantity + action.delta } : item
        );
      }
      return state;
    }
  );
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState({ delta: '', reason: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSearch = useCallback(() => router.push(pathname), [router, pathname]);

  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(initialItems);
    if (cursorMode) {
      setNextCursor(initialNextCursor ?? null);
      setHasMore(initialHasMore ?? false);
    }
    setLoading(false);
  }, [initialItems]);

  function getStockColor(qty: number, reorderPoint: number) {
    if (qty <= reorderPoint) return 'var(--danger)';
    if (qty < reorderPoint * 2) return 'var(--warning)';
    return 'var(--success)';
  }

  function openAdjust(item: InventoryItem) {
    setAdjusting(item.id);
    setAdjustForm({ delta: '', reason: '' });
    setErrors({});
  }

  function validateAdjust() {
    const payload = {
      inventoryItemId: adjusting || '',
      delta: parseInt(adjustForm.delta),
      reason: adjustForm.reason,
    };
    const result = adjustmentSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return null;
    }
    if (result.data.delta === 0) {
      setErrors({ delta: 'Delta must not be zero' });
      return null;
    }
    setErrors({});
    return result.data;
  }

  async function handleAdjust(itemId: string) {
    const validated = validateAdjust();
    if (!validated) return;

    const { delta, reason } = validated;

    startTransition(async () => {
      addOptimistic({ type: 'adjust', id: itemId, delta });
      setAdjusting(null);
      setAdjustForm({ delta: '', reason: '' });
      try {
        const res = await fetch('/api/v1/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inventoryItemId: itemId, delta, reason }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, quantity: item.quantity + delta } : item
          )
        );
        showToast(`Stock adjusted by ${delta > 0 ? '+' : ''}${delta}`);
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Failed to adjust stock', 'error');
      }
    });
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set('cursor', nextCursor!);
      params.set('take', '25');
      const res = await fetch(`/api/v1/inventory?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load more';
      showToast(message, 'error');
      if (items.length === 0) setError(message);
    } finally {
      setLoadingMore(false);
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
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Inventory</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {cursorMode ? totalCount : total} items across all warehouses
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchInput placeholder="Search by product name, SKU, or warehouse…" />
      </div>

      {loading ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table
              className="responsive-table"
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : error && optimisticItems.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setItems(initialItems);
          }}
        />
      ) : optimisticItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title={qParam ? 'No inventory matches your search' : 'No inventory found'}
          description={
            qParam
              ? 'Try a different search term or clear the filter.'
              : 'Try a different search or receive stock first.'
          }
          secondaryActionLabel={qParam ? 'Clear filter' : undefined}
          onSecondaryAction={qParam ? clearSearch : undefined}
        />
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden', opacity: isPending ? 0.7 : 1 }}>
            <div style={{ overflowX: 'auto' }}>
              <table
                className="responsive-table"
                style={{ width: '100%', borderCollapse: 'collapse' }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Product
                    </th>
                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Warehouse
                    </th>
                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Stock
                    </th>
                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Damaged
                    </th>
                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Reorder At
                    </th>
                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Status
                    </th>
                    {isAdmin && (
                      <th
                        style={{
                          padding: '16px 24px',
                          textAlign: 'center',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Adjust
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {optimisticItems.map((item) => {
                    const color = getStockColor(item.quantity, item.product.reorderPoint);
                    const status =
                      item.quantity <= item.product.reorderPoint
                        ? 'CRITICAL'
                        : item.quantity < item.product.reorderPoint * 2
                          ? 'LOW'
                          : 'HEALTHY';
                    const statusColor =
                      item.quantity <= item.product.reorderPoint
                        ? 'var(--danger)'
                        : item.quantity < item.product.reorderPoint * 2
                          ? 'var(--warning)'
                          : 'var(--success)';

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td data-label="Product" style={{ padding: '16px 24px' }}>
                          <div>
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: 'var(--text-heading)',
                              }}
                            >
                              {item.product.name}
                            </p>
                            <p className="tabular" style={{ fontSize: 12, color: 'var(--accent)' }}>
                              {item.product.sku}
                            </p>
                          </div>
                        </td>
                        <td data-label="Warehouse" style={{ padding: '16px 24px' }}>
                          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                            {item.warehouse.name}
                          </span>
                        </td>
                        <td
                          data-label="Stock"
                          style={{ padding: '16px 24px', textAlign: 'center' }}
                        >
                          <span
                            className="tabular"
                            style={{ fontSize: 20, fontWeight: 600, color }}
                          >
                            {item.quantity}
                          </span>
                        </td>
                        <td
                          data-label="Damaged"
                          style={{ padding: '16px 24px', textAlign: 'center' }}
                        >
                          {item.damaged > 0 ? (
                            <span
                              className="tabular"
                              style={{ fontSize: 14, fontWeight: 500, color: 'var(--danger)' }}
                            >
                              {item.damaged}
                            </span>
                          ) : (
                            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td
                          data-label="Reorder At"
                          style={{ padding: '16px 24px', textAlign: 'center' }}
                        >
                          <span
                            className="tabular"
                            style={{ fontSize: 14, color: 'var(--text-muted)' }}
                          >
                            {item.product.reorderPoint}
                          </span>
                        </td>
                        <td
                          data-label="Status"
                          style={{ padding: '16px 24px', textAlign: 'center' }}
                        >
                          <span
                            className="badge"
                            style={{ background: `${statusColor}15`, color: statusColor }}
                          >
                            {status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            {adjusting === item.id ? (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                  alignItems: 'center',
                                  minWidth: 160,
                                }}
                              >
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <input
                                    className="input tabular"
                                    type="number"
                                    value={adjustForm.delta}
                                    onChange={(e) =>
                                      setAdjustForm({ ...adjustForm, delta: e.target.value })
                                    }
                                    placeholder="+/-"
                                    style={{
                                      width: 70,
                                      textAlign: 'center',
                                      padding: '4px 8px',
                                      minHeight: 'auto',
                                    }}
                                    autoFocus
                                  />
                                  <input
                                    className="input"
                                    value={adjustForm.reason}
                                    onChange={(e) =>
                                      setAdjustForm({ ...adjustForm, reason: e.target.value })
                                    }
                                    placeholder="Reason"
                                    style={{
                                      width: 120,
                                      padding: '4px 8px',
                                      minHeight: 'auto',
                                      fontSize: 12,
                                    }}
                                  />
                                </div>
                                {errors.delta && (
                                  <p style={{ fontSize: 11, color: 'var(--danger)' }}>
                                    {errors.delta}
                                  </p>
                                )}
                                {errors.reason && (
                                  <p style={{ fontSize: 11, color: 'var(--danger)' }}>
                                    {errors.reason}
                                  </p>
                                )}
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    onClick={() => handleAdjust(item.id)}
                                    disabled={isPending}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: 12,
                                      background: 'var(--success)',
                                      color: '#022c22',
                                      border: 'none',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {isPending ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      'Apply'
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setAdjusting(null)}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: 12,
                                      background: 'rgba(255,255,255,0.06)',
                                      color: 'var(--text-secondary)',
                                      border: 'none',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => openAdjust(item)}
                                className="btn btn-ghost"
                                style={{
                                  padding: '8px 12px',
                                  minHeight: 'auto',
                                  fontSize: 12,
                                  gap: 4,
                                }}
                              >
                                Adjust
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {cursorMode ? (
            <CursorPagination
              totalCount={totalCount!}
              hasMore={hasMore}
              loading={loadingMore}
              onLoadMore={handleLoadMore}
            />
          ) : (
            <PaginationBar total={total!} page={page!} pageSize={pageSize!} />
          )}
        </>
      )}
    </div>
  );
}
