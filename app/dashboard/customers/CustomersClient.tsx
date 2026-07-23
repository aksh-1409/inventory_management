'use client';

import { useState, useEffect, useOptimistic, useTransition, useCallback } from 'react';
import { SkeletonRow } from '@/components/ui/Skeleton';
import {
  ShoppingCart,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  X,
  Loader2,
  Mail,
  Phone,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchInput } from '@/components/ui/SearchInput';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { useToast } from '@/components/ui/Toast';
import { customerSchema, customerUpdateSchema } from '@/lib/schemas';
import { useSelection } from '@/lib/useSelection';
import { SelectionBar } from '@/components/ui/SelectionBar';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface CustomerData {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  deletedAt: string | null;
  createdAt: string;
}

interface Props {
  initialCustomers: CustomerData[];
  total: number;
  page: number;
  pageSize: number;
  userRole: string;
  showDeleted: boolean;
}

const emptyForm = { name: '', email: '', phone: '' };

type OptimisticAction =
  | { type: 'create'; item: CustomerData }
  | { type: 'update'; id: string; updates: Partial<CustomerData> }
  | { type: 'delete'; id: string }
  | { type: 'restore'; id: string };

export default function CustomersClient({
  initialCustomers,
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
  const [customers, setCustomers] = useState<CustomerData[]>(initialCustomers);
  const [optimisticCustomers, addOptimistic] = useOptimistic(
    customers,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case 'create':
          return [...state, action.item];
        case 'update':
          return state.map((c) => (c.id === action.id ? { ...c, ...action.updates } : c));
        case 'delete':
          return state.filter((c) => c.id !== action.id);
        case 'restore':
          return state.map((c) => (c.id === action.id ? { ...c, deletedAt: null } : c));
        default:
          return state;
      }
    }
  );
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CustomerData | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selection = useSelection({ totalCount: total ?? 0 });

  const isAdmin = userRole === 'ADMIN';

  const clearSearch = useCallback(() => router.push(pathname), [router, pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomers(initialCustomers);
    setLoading(false);
  }, [initialCustomers]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  }
  function openEdit(c: CustomerData) {
    setEditing(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone });
    setErrors({});
    setShowModal(true);
  }
  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
  }

  function validateForm() {
    const payload = { name: form.name, email: form.email || null, phone: form.phone };
    const schema = editing ? customerUpdateSchema : customerSchema;
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

    if (editing) {
      startTransition(async () => {
        addOptimistic({ type: 'update', id: editing.id, updates: validated });
        try {
          const res = await fetch(`/api/v1/customers/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validated),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setCustomers((prev) =>
            prev.map((c) => (c.id === editing.id ? { ...c, ...data.customer } : c))
          );
          showToast('Customer updated');
          closeModal();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Something went wrong';
          showToast(message, 'error');
          if (customers.length === 0) setError(message);
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
          } as CustomerData,
        });
        try {
          const res = await fetch('/api/v1/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validated),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setCustomers((prev) => [
            ...prev,
            { ...data.customer, createdAt: data.customer.createdAt },
          ]);
          showToast('Customer created');
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
        const res = await fetch(`/api/v1/customers/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        showToast('Customer deleted', 'success', () => handleRestore(id));
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
    const res = await fetch('/api/v1/customers/bulk-delete', {
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
        const res = await fetch(`/api/v1/customers/${id}/restore`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, deletedAt: null } : c)));
        showToast('Customer restored');
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
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Customers</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {total} customers
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
          <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}>
            <Plus style={{ width: 16, height: 16 }} />
            Add Customer
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchInput placeholder="Search by name, email, or phone…" />
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
      ) : error && optimisticCustomers.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setCustomers(initialCustomers);
          }}
        />
      ) : optimisticCustomers.length === 0 && !showDeleted ? (
        <EmptyState
          icon={ShoppingCart}
          title={qParam ? 'No customers match your search' : 'No customers found'}
          description={
            qParam
              ? 'Try a different search term or clear the filter.'
              : 'Add your first customer to get started.'
          }
          actionLabel="Add Customer"
          onAction={openCreate}
          secondaryActionLabel={qParam ? 'Clear filter' : undefined}
          onSecondaryAction={qParam ? clearSearch : undefined}
        />
      ) : optimisticCustomers.length === 0 && showDeleted ? (
        <EmptyState
          icon={ShoppingCart}
          title="No deleted customers"
          description="All customers are active. Toggle off 'Show Deleted' to return."
        />
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden', opacity: isPending ? 0.7 : 1 }}>
            {(selection.selectionCount > 0 || selection.isAllPagesSelected) && (
              <SelectionBar
                count={selection.selectionCount}
                totalCount={total ?? 0}
                isAllPages={selection.isAllPagesSelected}
                entityLabel="customers"
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
                          (customers.length > 0 && selection.selectedIds.size === customers.length)
                        }
                        onChange={() => {
                          if (selection.isAllPagesSelected) {
                            selection.clearSelection();
                          } else if (selection.selectedIds.size === customers.length) {
                            selection.clearSelection();
                          } else {
                            selection.selectPage(customers.map((c) => c.id));
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
                      Name
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
                      Phone
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
                      Email
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
                  {optimisticCustomers.map((c) => {
                    const deleted = showDeleted && c.deletedAt !== null;
                    return (
                      <tr
                        key={c.id}
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
                            checked={selection.isSelected(c.id)}
                            onChange={() => selection.toggle(c.id)}
                            style={{
                              width: 16,
                              height: 16,
                              cursor: 'pointer',
                              accentColor: 'var(--accent)',
                            }}
                            aria-label={`Select ${c.name}`}
                          />
                        </td>
                        <td data-label="Name" style={{ padding: '16px 24px' }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: 'var(--text-heading)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {c.name}
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
                          </span>
                        </td>
                        <td data-label="Phone" style={{ padding: '16px 24px' }}>
                          <span
                            className="tabular"
                            style={{
                              fontSize: 14,
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <Phone style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                            {c.phone}
                          </span>
                        </td>
                        <td data-label="Email" style={{ padding: '16px 24px' }}>
                          {c.email ? (
                            <span
                              style={{
                                fontSize: 14,
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <Mail style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                              {c.email}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                              &mdash;
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {deleted ? (
                                <button
                                  onClick={() => handleRestore(c.id)}
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
                                    onClick={() => openEdit(c)}
                                    className="btn btn-ghost"
                                    style={{ padding: 8, minHeight: 'auto', minWidth: 'auto' }}
                                    aria-label="Edit"
                                  >
                                    <Pencil style={{ width: 14, height: 14 }} />
                                  </button>
                                  {deleteConfirm === c.id ? (
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button
                                        onClick={() => handleDelete(c.id)}
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
                                        Del
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
                                      onClick={() => setDeleteConfirm(c.id)}
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
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                {editing ? 'Edit Customer' : 'New Customer'}
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
                  placeholder="John Doe"
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
                  Phone *
                </label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1-555-000-0001"
                />
                {errors.phone && (
                  <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                    {errors.phone}
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
                  Email
                </label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@example.com"
                />
                {errors.email && (
                  <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                    {errors.email}
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
                  ) : editing ? (
                    'Save Changes'
                  ) : (
                    'Create Customer'
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
