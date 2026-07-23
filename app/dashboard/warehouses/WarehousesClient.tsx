'use client';

import { useState, useEffect, useOptimistic, useTransition, useCallback } from 'react';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Warehouse, Plus, Pencil, Trash2, RotateCcw, X, Loader2, MapPin } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchInput } from '@/components/ui/SearchInput';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { useToast } from '@/components/ui/Toast';
import { warehouseSchema, warehouseUpdateSchema } from '@/lib/schemas';
import { useSelection } from '@/lib/useSelection';
import { SelectionBar } from '@/components/ui/SelectionBar';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface WarehouseItem {
  id: string;
  quantity: number;
  product: { id: string; name: string; sku: string };
}

interface WarehouseData {
  id: string;
  name: string;
  location: string | null;
  deletedAt: string | null;
  createdAt: string;
  inventoryItems: WarehouseItem[];
  totalProducts: number;
  totalStock: number;
}

interface Props {
  initialWarehouses: WarehouseData[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
  showDeleted: boolean;
}

type OptimisticAction =
  | { type: 'create'; item: WarehouseData }
  | { type: 'update'; id: string; updates: Partial<WarehouseData> }
  | { type: 'delete'; id: string }
  | { type: 'restore'; id: string };

export default function WarehousesClient({
  initialWarehouses,
  total,
  page,
  pageSize,
  userRole,
  showDeleted,
}: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const [isPending, startTransition] = useTransition();
  const [warehouses, setWarehouses] = useState<WarehouseData[]>(initialWarehouses);
  const [optimisticWarehouses, addOptimistic] = useOptimistic(
    warehouses,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case 'create':
          return [...state, action.item];
        case 'update':
          return state.map((w) => (w.id === action.id ? { ...w, ...action.updates } : w));
        case 'delete':
          return state.filter((w) => w.id !== action.id);
        case 'restore':
          return state.map((w) => (w.id === action.id ? { ...w, deletedAt: null } : w));
        default:
          return state;
      }
    }
  );
  const [showModal, setShowModal] = useState(false);
  const [editingWH, setEditingWH] = useState<WarehouseData | null>(null);
  const [form, setForm] = useState({ name: '', location: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selection = useSelection({ totalCount: total ?? 0 });

  const isAdmin = userRole === 'ADMIN';

  const clearSearch = useCallback(() => router.push(pathname), [router, pathname]);

  useEffect(() => {
    setWarehouses(initialWarehouses);
    setLoading(false);
  }, [initialWarehouses]);

  function openCreate() {
    setEditingWH(null);
    setForm({ name: '', location: '' });
    setErrors({});
    setShowModal(true);
  }

  function openEdit(wh: WarehouseData) {
    setEditingWH(wh);
    setForm({ name: wh.name, location: wh.location || '' });
    setErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingWH(null);
    setForm({ name: '', location: '' });
    setErrors({});
  }

  function validateForm() {
    const payload = { name: form.name, location: form.location || null };
    const schema = editingWH ? warehouseUpdateSchema : warehouseSchema;
    const result = schema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return null;
    }
    setErrors({});
    return result.data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validated = validateForm();
    if (!validated) return;

    if (editingWH) {
      startTransition(async () => {
        addOptimistic({ type: 'update', id: editingWH.id, updates: validated });
        try {
          const res = await fetch(`/api/v1/warehouses/${editingWH.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validated),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setWarehouses((prev) =>
            prev.map((w) => (w.id === editingWH.id ? { ...w, ...data.warehouse } : w))
          );
          showToast('Warehouse updated');
          closeModal();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Something went wrong';
          showToast(message, 'error');
          if (warehouses.length === 0) setError(message);
        }
      });
    } else {
      startTransition(async () => {
        addOptimistic({
          type: 'create',
          item: {
            ...validated,
            id: `new-${Date.now()}`,
            createdAt: new Date().toISOString(),
            inventoryItems: [],
            totalProducts: 0,
            totalStock: 0,
          } as WarehouseData,
        });
        try {
          const res = await fetch('/api/v1/warehouses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validated),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setWarehouses((prev) => [
            ...prev,
            {
              ...data.warehouse,
              inventoryItems: [],
              totalProducts: 0,
              totalStock: 0,
              createdAt: data.warehouse.createdAt,
            },
          ]);
          showToast('Warehouse created');
          closeModal();
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : 'Something went wrong', 'error');
        }
      });
    }
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      addOptimistic({ type: 'delete', id });
      setDeleteConfirm(null);
      try {
        const res = await fetch(`/api/v1/warehouses/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        setWarehouses((prev) => prev.filter((w) => w.id !== id));
        showToast('Warehouse deleted', 'success', () => handleRestore(id));
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
      }
    });
  }

  async function handleBulkDelete() {
    const ids = selection.isAllPagesSelected ? [] : Array.from(selection.selectedIds);
    const payload = selection.isAllPagesSelected
      ? { allMatching: true, searchParams: qParam }
      : { ids };
    const res = await fetch('/api/v1/warehouses/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Bulk delete failed');
    selection.clearSelection();
    router.refresh();
  }

  async function handleRestore(id: string) {
    startTransition(async () => {
      addOptimistic({ type: 'restore', id });
      try {
        const res = await fetch(`/api/v1/warehouses/${id}/restore`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setWarehouses((prev) => prev.map((w) => (w.id === id ? { ...w, deletedAt: null } : w)));
        showToast('Warehouse restored');
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Failed to restore', 'error');
      }
    });
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
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>
            Warehouses
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {total} locations
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <a
              href={showDeleted ? '?' : '?showDeleted=1'}
              className="btn btn-ghost"
              style={{ gap: 6, fontSize: 13, color: showDeleted ? 'var(--accent)' : undefined }}
            >
              {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
            </a>
          )}
          {isAdmin && (
            <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}>
              <Plus style={{ width: 16, height: 16 }} />
              Add Warehouse
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchInput placeholder="Search warehouses…" />
      </div>

      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error && optimisticWarehouses.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            router.refresh();
          }}
        />
      ) : optimisticWarehouses.length === 0 && !showDeleted ? (
        <EmptyState
          icon={Warehouse}
          title={qParam ? 'No warehouses match your search' : 'No warehouses found'}
          description={
            qParam
              ? 'Try a different search term or clear the filter.'
              : 'Add your first location to get started.'
          }
          actionLabel={isAdmin ? 'Add Warehouse' : undefined}
          onAction={isAdmin ? openCreate : undefined}
          secondaryActionLabel={qParam ? 'Clear filter' : undefined}
          onSecondaryAction={qParam ? clearSearch : undefined}
        />
      ) : optimisticWarehouses.length === 0 && showDeleted ? (
        <EmptyState
          icon={Warehouse}
          title="No deleted warehouses"
          description="All warehouses are active. Toggle off 'Show Deleted' to return."
        />
      ) : (
        <>
          {isAdmin && (selection.selectionCount > 0 || selection.isAllPagesSelected) && (
            <SelectionBar
              count={selection.selectionCount}
              totalCount={total ?? 0}
              isAllPages={selection.isAllPagesSelected}
              entityLabel="warehouses"
              onClear={selection.clearSelection}
              onDeleteSelected={handleBulkDelete}
              deleteLabel="Delete selected"
            />
          )}
          {isAdmin && (
            <div style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={
                  selection.isAllPagesSelected ||
                  (warehouses.length > 0 && selection.selectedIds.size === warehouses.length)
                }
                onChange={() => {
                  if (selection.isAllPagesSelected) {
                    selection.clearSelection();
                  } else if (selection.selectedIds.size === warehouses.length) {
                    selection.clearSelection();
                  } else {
                    selection.selectPage(warehouses.map((w) => w.id));
                  }
                }}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                aria-label="Select all on page"
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
                {selection.selectionCount > 0
                  ? `${selection.selectionCount} selected`
                  : 'Select all'}
              </span>
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {optimisticWarehouses.map((wh) => {
              const deleted = showDeleted && wh.deletedAt !== null;
              return (
                <div
                  key={wh.id}
                  className="card"
                  style={{ padding: 20, opacity: deleted ? 0.5 : 1 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={selection.isSelected(wh.id)}
                          onChange={() => selection.toggle(wh.id)}
                          style={{
                            width: 16,
                            height: 16,
                            cursor: 'pointer',
                            accentColor: 'var(--accent)',
                          }}
                          aria-label={`Select ${wh.name}`}
                        />
                      )}
                      <div>
                        <h3
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: 'var(--text-heading)',
                            marginBottom: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {wh.name}
                          {deleted && (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                color: 'var(--text-muted)',
                                fontSize: 10,
                                padding: '1px 6px',
                              }}
                            >
                              Deleted
                            </span>
                          )}
                        </h3>
                        {wh.location && (
                          <p
                            style={{
                              fontSize: 14,
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <MapPin style={{ width: 12, height: 12 }} />
                            {wh.location}
                          </p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {deleted ? (
                          <button
                            onClick={() => handleRestore(wh.id)}
                            className="btn btn-ghost"
                            style={{
                              padding: 8,
                              minHeight: 'auto',
                              minWidth: 'auto',
                              color: 'var(--success)',
                            }}
                            title="Restore"
                          >
                            <RotateCcw style={{ width: 14, height: 14 }} />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(wh)}
                              className="btn btn-ghost"
                              style={{ padding: 8, minHeight: 'auto', minWidth: 'auto' }}
                              aria-label="Edit"
                            >
                              <Pencil style={{ width: 14, height: 14 }} />
                            </button>
                            {deleteConfirm === wh.id ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  onClick={() => handleDelete(wh.id)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 12,
                                    background: 'rgba(248,113,113,0.1)',
                                    color: 'var(--danger)',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="btn btn-ghost"
                                  style={{ padding: 8, minHeight: 'auto' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(wh.id)}
                                className="btn btn-ghost"
                                style={{ padding: 8, minHeight: 'auto', minWidth: 'auto' }}
                                aria-label="Delete"
                              >
                                <Trash2 style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="surface-0" style={{ padding: '12px 16px', borderRadius: 8 }}>
                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: 4,
                        }}
                      >
                        Products
                      </p>
                      <p
                        className="tabular"
                        style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}
                      >
                        {wh.totalProducts}
                      </p>
                    </div>
                    <div className="surface-0" style={{ padding: '12px 16px', borderRadius: 8 }}>
                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: 4,
                        }}
                      >
                        Total Stock
                      </p>
                      <p
                        className="tabular"
                        style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}
                      >
                        {wh.totalStock}
                      </p>
                    </div>
                  </div>

                  {wh.inventoryItems.length > 0 && (
                    <div
                      style={{
                        marginTop: 16,
                        borderTop: '1px solid var(--border)',
                        paddingTop: 12,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: 8,
                        }}
                      >
                        Stock Breakdown
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {wh.inventoryItems.slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 14,
                            }}
                          >
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {item.product.name}
                            </span>
                            <span
                              className="tabular"
                              style={{ color: 'var(--text-heading)', fontWeight: 500 }}
                            >
                              {item.quantity}
                            </span>
                          </div>
                        ))}
                        {wh.inventoryItems.length > 5 && (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            +{wh.inventoryItems.length - 5} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <PaginationBar total={total} page={page} pageSize={pageSize} />
        </>
      )}

      {showModal && (
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
            onClick={closeModal}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
          />
          <div
            className="surface-2"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
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
                {editingWH ? 'Edit Warehouse' : 'New Warehouse'}
              </h2>
              <button
                onClick={closeModal}
                className="btn btn-ghost"
                style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}
                aria-label="Close"
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
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
                  Name *
                </label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="NYC Flagship"
                />
                {errors.name && (
                  <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                    {errors.name}
                  </p>
                )}
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
                  Location
                </label>
                <input
                  className="input"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="New York City, NY"
                />
                {errors.location && (
                  <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                    {errors.location}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={closeModal} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingWH ? (
                    'Save Changes'
                  ) : (
                    'Create Warehouse'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
