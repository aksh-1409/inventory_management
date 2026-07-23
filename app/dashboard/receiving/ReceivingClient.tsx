'use client';

import { useState, useMemo, useOptimistic, useTransition, useEffect } from 'react';
import { Truck, Plus, Search, X, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ReceivingReportDownload } from '@/components/pdf/TransferPDFs';
import { receiveSchema } from '@/lib/schemas';

interface Receipt {
  id: string;
  delta: number;
  reference: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  warehouse: { id: string; name: string };
  unitCost?: number | null;
  totalCost?: number | null;
  supplier?: { id: string; name: string } | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}
interface Warehouse {
  id: string;
  name: string;
}
interface Supplier {
  id: string;
  name: string;
}

interface Props {
  initialReceipts: Receipt[];
  totalNumber: number;
  products: Product[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  userRole: string;
}

type OptimisticAction = { type: 'create'; receipt: Receipt };

export default function ReceivingClient({
  initialReceipts,
  products,
  warehouses,
  suppliers,
  userRole,
}: Props) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [optimisticReceipts, addOptimistic] = useOptimistic(
    receipts,
    (state, action: OptimisticAction) => {
      if (action.type === 'create') return [action.receipt, ...state];
      return state;
    }
  );
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    warehouseId: '',
    supplierId: '',
    quantity: '',
    unitCost: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    setLoading(false);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return optimisticReceipts;
    const q = search.toLowerCase();
    return optimisticReceipts.filter(
      (r) =>
        r.product.name.toLowerCase().includes(q) ||
        r.product.sku.toLowerCase().includes(q) ||
        r.warehouse.name.toLowerCase().includes(q)
    );
  }, [optimisticReceipts, search]);

  function openCreate() {
    setForm({
      productId: '',
      warehouseId: '',
      supplierId: '',
      quantity: '',
      unitCost: '',
      notes: '',
    });
    setErrors({});
    setShowModal(true);
  }

  function validateForm() {
    const payload = {
      productId: form.productId,
      warehouseId: form.warehouseId,
      supplierId: form.supplierId,
      quantity: parseInt(form.quantity),
      unitCost: form.unitCost ? parseFloat(form.unitCost) : undefined,
      notes: form.notes || undefined,
    };
    const result = receiveSchema.safeParse(payload);
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

    const qty = validated.quantity;
    const product = products.find((p) => p.id === validated.productId);
    const warehouse = warehouses.find((w) => w.id === validated.warehouseId);
    const supplier = suppliers.find((s) => s.id === validated.supplierId);

    startTransition(async () => {
      addOptimistic({
        type: 'create',
        receipt: {
          id: `new-${Date.now()}`,
          delta: qty,
          reference: form.notes || 'Received from supplier',
          createdAt: new Date().toISOString(),
          product: product
            ? { id: product.id, name: product.name, sku: product.sku }
            : { id: '', name: '', sku: '' },
          warehouse: warehouse ? { id: warehouse.id, name: warehouse.name } : { id: '', name: '' },
          unitCost: validated.unitCost ?? null,
          totalCost: validated.unitCost ? qty * validated.unitCost : null,
          supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
        },
      });
      setShowModal(false);

      try {
        const res = await fetch('/api/v1/receive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validated),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setReceipts((prev) => [
          {
            id: data.receipt.id,
            delta: qty,
            reference: form.notes || 'Received from supplier',
            createdAt: data.receipt.createdAt,
            product: product
              ? { id: product.id, name: product.name, sku: product.sku }
              : { id: '', name: '', sku: '' },
            warehouse: warehouse
              ? { id: warehouse.id, name: warehouse.name }
              : { id: '', name: '' },
            unitCost: validated.unitCost ?? null,
            totalCost: validated.unitCost ? qty * validated.unitCost : null,
            supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
          },
          ...prev,
        ]);
        showToast(`Received ${qty} units`);
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Failed to receive stock', 'error');
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
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Receiving</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {receipts.length} received shipments
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}>
          <Plus style={{ width: 16, height: 16 }} />
          Receive Shipment
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
          placeholder="Search receipts..."
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
      ) : error && filtered.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setReceipts(initialReceipts);
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No receipts yet"
          description={search ? 'Try a different search.' : 'Record your first shipment receipt.'}
        />
      ) : (
        <div className="card" style={{ overflow: 'hidden', opacity: isPending ? 0.7 : 1 }}>
          <div style={{ overflowX: 'auto' }}>
            <table
              className="responsive-table"
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Product', 'SKU', 'Warehouse', 'Qty', 'Date', 'Reference', 'PDF'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '16px 24px',
                        textAlign: h === 'Qty' ? 'center' : 'left',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td data-label="Product" style={{ padding: '16px 24px' }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-heading)' }}>
                        {r.product.name}
                      </p>
                    </td>
                    <td data-label="SKU" style={{ padding: '16px 24px' }}>
                      <span className="tabular" style={{ fontSize: 13, color: 'var(--accent)' }}>
                        {r.product.sku}
                      </span>
                    </td>
                    <td data-label="Warehouse" style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {r.warehouse.name}
                      </span>
                    </td>
                    <td data-label="Qty" style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <span
                        className="tabular"
                        style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}
                      >
                        +{r.delta}
                      </span>
                    </td>
                    <td data-label="Date" style={{ padding: '16px 24px' }}>
                      <span
                        className="tabular"
                        style={{ fontSize: 13, color: 'var(--text-muted)' }}
                      >
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td data-label="Reference" style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {r.reference || '-'}
                      </span>
                    </td>
                    <td data-label="PDF" style={{ padding: '16px 24px' }}>
                      <ReceivingReportDownload
                        transfer={{
                          id: r.id,
                          product: r.product,
                          fromWarehouse: { name: r.supplier?.name || 'Supplier' },
                          toWarehouse: r.warehouse,
                          quantityInitiated: r.delta,
                          quantityReceived: r.delta,
                          damagedQuantity: 0,
                          unitCost: r.unitCost ?? null,
                          totalCost: r.totalCost ?? null,
                          receivedAt: r.createdAt,
                          notes: r.reference,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
            onClick={() => setShowModal(false)}
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
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>
                Receive Shipment
              </h2>
              <button
                onClick={() => setShowModal(false)}
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
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                  }}
                >
                  Product *
                </label>
                <CustomSelect
                  options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
                  value={form.productId}
                  onChange={(v) => setForm({ ...form, productId: v })}
                  placeholder="Select product..."
                />
                {errors.productId && (
                  <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                    {errors.productId}
                  </p>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    }}
                  >
                    Warehouse *
                  </label>
                  <CustomSelect
                    options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                    value={form.warehouseId}
                    onChange={(v) => setForm({ ...form, warehouseId: v })}
                    placeholder="Select..."
                  />
                  {errors.warehouseId && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.warehouseId}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    }}
                  >
                    Supplier *
                  </label>
                  <CustomSelect
                    options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    value={form.supplierId}
                    onChange={(v) => setForm({ ...form, supplierId: v })}
                    placeholder="Select..."
                  />
                  {errors.supplierId && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.supplierId}
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    }}
                  >
                    Quantity *
                  </label>
                  <input
                    className="input tabular"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                  {errors.quantity && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.quantity}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    }}
                  >
                    Unit Cost
                  </label>
                  <input
                    className="input tabular"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unitCost}
                    onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                    placeholder="Optional"
                  />
                  {errors.unitCost && (
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.unitCost}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                  }}
                >
                  Notes
                </label>
                <input
                  className="input"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes..."
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Receive Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
