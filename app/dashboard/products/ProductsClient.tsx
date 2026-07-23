'use client';

import { useState, useEffect, useOptimistic, useTransition, useCallback } from 'react';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Package, Plus, Pencil, Trash2, RotateCcw, X, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchInput } from '@/components/ui/SearchInput';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { CursorPagination } from '@/components/ui/CursorPagination';
import { useToast } from '@/components/ui/Toast';
import { ExportButton } from '@/components/ui/ExportButton';
import { productSchema, productUpdateSchema } from '@/lib/schemas';
import { useSelection } from '@/lib/useSelection';
import { SelectionBar } from '@/components/ui/SelectionBar';

interface InventoryEntry {
  id: string;
  quantity: number;
  warehouse: { id: string; name: string };
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  costPrice: number | null;
  reorderPoint: number;
  category: string | null;
  deletedAt: string | null;
  createdAt: string;
  inventoryItems: InventoryEntry[];
}

interface Warehouse {
  id: string;
  name: string;
}

interface Props {
  initialProducts: Product[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
  warehouses: Warehouse[];
  userRole: string;
  showDeleted: boolean;
}

const emptyForm = {
  sku: '',
  name: '',
  description: '',
  price: '',
  costPrice: '',
  reorderPoint: '5',
  category: '',
};

type OptimisticAction =
  | { type: 'create'; item: Product }
  | { type: 'update'; id: string; updates: Partial<Product> }
  | { type: 'delete'; id: string }
  | { type: 'restore'; item: Product };

export default function ProductsClient({
  initialProducts,
  total,
  page,
  pageSize,
  totalCount,
  nextCursor: initialNextCursor,
  hasMore: initialHasMore,
  warehouses,
  userRole,
  showDeleted,
}: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const cursorMode = initialNextCursor !== undefined;
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null);
  const [hasMore, setHasMore] = useState(initialHasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [optimisticProducts, addOptimistic] = useOptimistic(
    products,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case 'create':
          return [...state, action.item];
        case 'update':
          return state.map((p) => (p.id === action.id ? { ...p, ...action.updates } : p));
        case 'delete':
          return state.filter((p) => p.id !== action.id);
        case 'restore':
          return state.map((p) => (p.id === action.item.id ? { ...p, deletedAt: null } : p));
        default:
          return state;
      }
    }
  );
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selection = useSelection({ totalCount: total ?? totalCount ?? 0 });

  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProducts(initialProducts);
    if (cursorMode) {
      setNextCursor(initialNextCursor ?? null);
      setHasMore(initialHasMore ?? false);
    }
    setLoading(false);
  }, [
    initialProducts,
    cursorMode ? initialNextCursor : undefined,
    cursorMode ? initialHasMore : undefined,
  ]);

  function openCreate() {
    setEditingProduct(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      costPrice: product.costPrice?.toString() || '',
      reorderPoint: product.reorderPoint.toString(),
      category: product.category || '',
    });
    setErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setErrors({});
  }

  function validateForm() {
    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
      reorderPoint: parseInt(form.reorderPoint) || 5,
      category: form.category || null,
    };
    const schema = editingProduct ? productUpdateSchema : productSchema;
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

    const payload = validated;

    if (editingProduct) {
      startTransition(async () => {
        addOptimistic({ type: 'update', id: editingProduct.id, updates: payload });
        try {
          const res = await fetch(`/api/v1/products/${editingProduct.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setProducts((prev) =>
            prev.map((p) => (p.id === editingProduct.id ? { ...p, ...data.product } : p))
          );
          showToast('Product updated');
          closeModal();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Something went wrong';
          showToast(message, 'error');
          if (products.length === 0) setError(message);
        }
      });
    } else {
      startTransition(async () => {
        const optimisticId = `new-${Date.now()}`;
        addOptimistic({
          type: 'create',
          item: {
            ...payload,
            id: optimisticId,
            deletedAt: null,
            createdAt: new Date().toISOString(),
            inventoryItems: [],
          } as Product,
        });
        try {
          const res = await fetch('/api/v1/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setProducts((prev) => [
            ...prev,
            { ...data.product, inventoryItems: [], createdAt: data.product.createdAt },
          ]);
          showToast('Product created');
          closeModal();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create';
          showToast(message, 'error');
          if (products.length === 0) setError(message);
        }
      });
    }
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      addOptimistic({ type: 'delete', id });
      setDeleteConfirm(null);
      try {
        const res = await fetch(`/api/v1/products/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        setProducts((prev) => prev.filter((p) => p.id !== id));
        showToast('Product deleted', 'success', () => handleRestore(id));
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
      }
    });
  }

  async function handleRestore(id: string) {
    startTransition(async () => {
      const item = products.find((p) => p.id === id);
      if (item) addOptimistic({ type: 'restore', item });
      try {
        const res = await fetch(`/api/v1/products/${id}/restore`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, deletedAt: null } : p)));
        showToast('Product restored');
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Failed to restore', 'error');
      }
    });
  }

  async function handleBulkDelete() {
    const ids = selection.isAllPagesSelected
      ? Array.from(selection.selectedIds).length > 0
        ? Array.from(selection.selectedIds)
        : []
      : Array.from(selection.selectedIds);
    const payload =
      selection.isAllPagesSelected && ids.length === 0
        ? { allMatching: true, searchParams: qParam }
        : { ids };
    const res = await fetch('/api/v1/products/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Bulk delete failed');
    }
    selection.clearSelection();
    router.refresh();
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set('cursor', nextCursor!);
      params.set('take', '25');
      const res = await fetch(`/api/v1/products?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts((prev) => [...prev, ...data.products]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load more';
      showToast(message, 'error');
      if (products.length === 0) setError(message);
    } finally {
      setLoadingMore(false);
    }
  }

  function getTotalStock(product: Product) {
    return product.inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  function getStockByWarehouse(product: Product, warehouseId: string) {
    const item = product.inventoryItems.find((i) => i.warehouse.id === warehouseId);
    return item?.quantity || 0;
  }

  const clearSearch = useCallback(() => router.push(pathname), [router, pathname]);

  const isDeleted = (product: Product) => showDeleted && product.deletedAt !== null;

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
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Products</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {total} products in catalog
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportButton
            csvUrl={`/api/v1/products?export=csv${qParam ? `&q=${encodeURIComponent(qParam)}` : ''}`}
            pdfUrl={`/api/v1/products?export=pdf${qParam ? `&q=${encodeURIComponent(qParam)}` : ''}`}
          />
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
              Add Product
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchInput placeholder="Search by name, SKU, or category…" />
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
      ) : error && optimisticProducts.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            router.refresh();
          }}
        />
      ) : optimisticProducts.length === 0 && !showDeleted ? (
        <EmptyState
          icon={Package}
          title={qParam ? 'No products match your search' : 'No products found'}
          description={
            qParam
              ? 'Try a different search term or clear the filter.'
              : 'Add your first product to get started.'
          }
          actionLabel={isAdmin ? 'Add Product' : undefined}
          onAction={isAdmin ? openCreate : undefined}
          secondaryActionLabel={qParam ? 'Clear filter' : undefined}
          onSecondaryAction={qParam ? clearSearch : undefined}
        />
      ) : optimisticProducts.length === 0 && showDeleted ? (
        <EmptyState
          icon={Package}
          title="No deleted products"
          description="All products are active. Toggle off 'Show Deleted' to return."
        />
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden', opacity: isPending ? 0.7 : 1 }}>
            {(selection.selectionCount > 0 || selection.isAllPagesSelected) && (
              <SelectionBar
                count={selection.selectionCount}
                totalCount={total ?? totalCount ?? 0}
                isAllPages={selection.isAllPagesSelected}
                entityLabel="products"
                onClear={selection.clearSelection}
                onDeleteSelected={handleBulkDelete}
                deleteLabel="Delete selected"
              />
            )}
            <div style={{ overflowX: 'auto' }}>
              <table
                className="responsive-table"
                style={{ width: '100%', borderCollapse: 'collapse' }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: 44, padding: '12px 8px' }}>
                      <input
                        type="checkbox"
                        checked={
                          selection.isAllPagesSelected ||
                          (products.length > 0 && selection.selectedIds.size === products.length)
                        }
                        onChange={() => {
                          if (selection.isAllPagesSelected) {
                            selection.clearSelection();
                          } else if (selection.selectedIds.size === products.length) {
                            selection.clearSelection();
                          } else {
                            selection.selectPage(products.map((p) => p.id));
                          }
                        }}
                        style={{
                          width: 16,
                          height: 16,
                          cursor: 'pointer',
                          accentColor: 'var(--accent)',
                        }}
                        aria-label="Select all on page"
                      />
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
                      SKU
                    </th>
                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'right',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Price
                    </th>
                    {warehouses.map((w) => (
                      <th
                        key={w.id}
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
                        {w.name}
                      </th>
                    ))}
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
                      Total
                    </th>
                    {isAdmin && (
                      <th
                        style={{
                          padding: '16px 24px',
                          textAlign: 'right',
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {optimisticProducts.map((product) => {
                    const total = getTotalStock(product);
                    const deleted = isDeleted(product);
                    return (
                      <tr
                        key={product.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          opacity: deleted ? 0.5 : 1,
                        }}
                      >
                        <td
                          data-label=""
                          style={{ width: 44, padding: '8px', textAlign: 'center' }}
                        >
                          <input
                            type="checkbox"
                            checked={selection.isSelected(product.id)}
                            onChange={() => selection.toggle(product.id)}
                            style={{
                              width: 16,
                              height: 16,
                              cursor: 'pointer',
                              accentColor: 'var(--accent)',
                            }}
                            aria-label={`Select ${product.name}`}
                          />
                        </td>
                        <td data-label="Product" style={{ padding: '16px 24px' }}>
                          <div>
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: 'var(--text-heading)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              {product.name}
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
                            </p>
                            {product.category && (
                              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {product.category}
                              </p>
                            )}
                          </div>
                        </td>
                        <td data-label="SKU" style={{ padding: '16px 24px' }}>
                          <span
                            className="tabular"
                            style={{ fontSize: 14, color: 'var(--accent)' }}
                          >
                            {product.sku}
                          </span>
                        </td>
                        <td data-label="Price" style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <span className="tabular" style={{ fontSize: 14, fontWeight: 500 }}>
                            ${product.price.toFixed(2)}
                          </span>
                        </td>
                        {warehouses.map((w) => {
                          const qty = getStockByWarehouse(product, w.id);
                          const color =
                            qty <= product.reorderPoint
                              ? 'var(--danger)'
                              : qty < product.reorderPoint * 2
                                ? 'var(--warning)'
                                : 'var(--success)';
                          return (
                            <td
                              key={w.id}
                              data-label={w.name}
                              style={{ padding: '16px 24px', textAlign: 'center' }}
                            >
                              <span
                                className="tabular"
                                style={{ fontSize: 14, fontWeight: 600, color }}
                              >
                                {qty}
                              </span>
                            </td>
                          );
                        })}
                        <td
                          data-label="Total"
                          style={{ padding: '16px 24px', textAlign: 'center' }}
                        >
                          <span
                            className="tabular"
                            style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-heading)' }}
                          >
                            {total}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {deleted ? (
                                <button
                                  onClick={() => handleRestore(product.id)}
                                  className="btn btn-ghost"
                                  style={{
                                    padding: '8px 8px',
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
                                    onClick={() => openEdit(product)}
                                    className="btn btn-ghost"
                                    style={{
                                      padding: '8px 8px',
                                      minHeight: 'auto',
                                      minWidth: 'auto',
                                    }}
                                    title="Edit"
                                  >
                                    <Pencil style={{ width: 14, height: 14 }} />
                                  </button>
                                  {deleteConfirm === product.id ? (
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                      <button
                                        onClick={() => handleDelete(product.id)}
                                        className="btn btn-danger"
                                        style={{
                                          padding: '8px 12px',
                                          minHeight: 'auto',
                                          fontSize: 12,
                                          background: 'rgba(248,113,113,0.1)',
                                          color: 'var(--danger)',
                                        }}
                                      >
                                        Delete
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="btn btn-ghost"
                                        style={{ padding: '8px 8px', minHeight: 'auto' }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirm(product.id)}
                                      className="btn btn-ghost"
                                      style={{
                                        padding: '8px 8px',
                                        minHeight: 'auto',
                                        minWidth: 'auto',
                                      }}
                                      title="Delete"
                                    >
                                      <Trash2 style={{ width: 14, height: 14 }} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
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
              maxWidth: 480,
              borderRadius: 12,
              border: '1px solid var(--border)',
              padding: 24,
              maxHeight: '90vh',
              overflowY: 'auto',
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
                {editingProduct ? 'Edit Product' : 'New Product'}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                    SKU *
                  </label>
                  <input
                    className="input"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="AM-90-WHT-10"
                  />
                  {errors.sku && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.sku}
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
                    Name *
                  </label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Air Max 90"
                  />
                  {errors.name && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.name}
                    </p>
                  )}
                </div>
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
                  Description
                </label>
                <input
                  className="input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Classic Nike Air Max 90 in white, size 10"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
                    Price *
                  </label>
                  <input
                    className="input tabular"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="120.00"
                  />
                  {errors.price && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.price}
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
                    Cost Price
                  </label>
                  <input
                    className="input tabular"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    placeholder="65.00"
                  />
                  {errors.costPrice && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.costPrice}
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
                    Reorder Point
                  </label>
                  <input
                    className="input tabular"
                    type="number"
                    min="0"
                    value={form.reorderPoint}
                    onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })}
                    placeholder="5"
                  />
                  {errors.reorderPoint && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.reorderPoint}
                    </p>
                  )}
                </div>
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
                  Category
                </label>
                <input
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Sneakers"
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={closeModal} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingProduct ? (
                    'Save Changes'
                  ) : (
                    'Create Product'
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
