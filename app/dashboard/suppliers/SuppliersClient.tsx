'use client'

import { useState, useEffect, useOptimistic, useTransition, useCallback } from 'react'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Truck, Plus, Pencil, Trash2, RotateCcw, X, Loader2, Mail, Phone } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SearchInput } from '@/components/ui/SearchInput'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { useToast } from '@/components/ui/Toast'
import { supplierSchema, supplierUpdateSchema } from '@/lib/schemas'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

interface SupplierData {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  deletedAt: string | null
  createdAt: string
}

interface Props {
  initialSuppliers: SupplierData[]
  total: number
  page: number
  pageSize: number
  userRole: string
  showDeleted: boolean
}

const emptyForm = { name: '', contactName: '', email: '', phone: '' }

type OptimisticAction =
  | { type: 'create'; item: SupplierData }
  | { type: 'update'; id: string; updates: Partial<SupplierData> }
  | { type: 'delete'; id: string }
  | { type: 'restore'; id: string }

export default function SuppliersClient({ initialSuppliers, total, page, pageSize, userRole, showDeleted }: Props) {
  const { showToast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qParam = searchParams.get('q') || ''
  const [isPending, startTransition] = useTransition()
  const [suppliers, setSuppliers] = useState<SupplierData[]>(initialSuppliers)
  const [optimisticSuppliers, addOptimistic] = useOptimistic(suppliers, (state, action: OptimisticAction) => {
    switch (action.type) {
      case 'create': return [...state, action.item]
      case 'update': return state.map((s) => (s.id === action.id ? { ...s, ...action.updates } : s))
      case 'delete': return state.filter((s) => s.id !== action.id)
      case 'restore': return state.map((s) => (s.id === action.id ? { ...s, deletedAt: null } : s))
      default: return state
    }
  })
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SupplierData | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = userRole === 'ADMIN'

  const clearSearch = useCallback(() => router.push(pathname), [router, pathname])

  useEffect(() => { setSuppliers(initialSuppliers); setLoading(false) }, [initialSuppliers])

  function openCreate() { setEditing(null); setForm(emptyForm); setErrors({}); setShowModal(true) }
  function openEdit(s: SupplierData) { setEditing(s); setForm({ name: s.name, contactName: s.contactName || '', email: s.email || '', phone: s.phone || '' }); setErrors({}); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditing(null); setForm(emptyForm); setErrors({}) }

  function validateForm() {
    const payload = { name: form.name, contactName: form.contactName || null, email: form.email || null, phone: form.phone || null }
    const schema = editing ? supplierUpdateSchema : supplierSchema
    const result = schema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setErrors(fieldErrors)
      return null
    }
    setErrors({})
    return result.data
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validated = validateForm()
    if (!validated) return

    if (editing) {
      startTransition(async () => {
        addOptimistic({ type: 'update', id: editing.id, updates: validated })
        try {
          const res = await fetch(`/api/v1/suppliers/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validated) })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          setSuppliers((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...data.supplier } : s)))
          showToast('Supplier updated')
          closeModal()
        } catch (err: any) { showToast(err.message || 'Something went wrong', 'error'); if (suppliers.length === 0) setError(err.message || 'Something went wrong') }
      })
    } else {
      startTransition(async () => {
        addOptimistic({ type: 'create', item: { ...validated as any, id: `new-${Date.now()}`, createdAt: new Date().toISOString() } })
        try {
          const res = await fetch('/api/v1/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validated) })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          setSuppliers((prev) => [...prev, { ...data.supplier, createdAt: data.supplier.createdAt }])
          showToast('Supplier created')
          closeModal()
        } catch (err: any) { showToast(err.message || 'Something went wrong', 'error') }
      })
    }
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      addOptimistic({ type: 'delete', id })
      setDeleteConfirm(null)
      try {
        const res = await fetch(`/api/v1/suppliers/${id}`, { method: 'DELETE' })
        if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
        setSuppliers((prev) => prev.filter((s) => s.id !== id))
        showToast('Supplier deleted', 'success', () => handleRestore(id))
      } catch (err: any) { showToast(err.message || 'Failed to delete', 'error') }
    })
  }

  async function handleRestore(id: string) {
    startTransition(async () => {
      addOptimistic({ type: 'restore', id })
      try {
        const res = await fetch(`/api/v1/suppliers/${id}/restore`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, deletedAt: null } : s)))
        showToast('Supplier restored')
      } catch (err: any) { showToast(err.message || 'Failed to restore', 'error') }
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Suppliers</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>{total} suppliers</p>
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
          <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}><Plus style={{ width: 16, height: 16 }} />Add Supplier</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchInput placeholder="Search suppliers…" />
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error && optimisticSuppliers.length === 0 ? (
        <ErrorState message={error} onRetry={() => { setError(null); setSuppliers(initialSuppliers) }} />
      ) : optimisticSuppliers.length === 0 && !showDeleted ? (
        <EmptyState icon={Truck} title={qParam ? 'No suppliers match your search' : 'No suppliers found'} description={qParam ? 'Try a different search term or clear the filter.' : 'Add your first supplier to get started.'} actionLabel="Add Supplier" onAction={openCreate} secondaryActionLabel={qParam ? 'Clear filter' : undefined} onSecondaryAction={qParam ? clearSearch : undefined} />
      ) : optimisticSuppliers.length === 0 && showDeleted ? (
        <EmptyState icon={Truck} title="No deleted suppliers" description="All suppliers are active. Toggle off 'Show Deleted' to return." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, opacity: isPending ? 0.7 : 1 }}>
            {optimisticSuppliers.map((s) => {
              const deleted = showDeleted && s.deletedAt !== null
              return (
              <div key={s.id} className="card" style={{ padding: 20, opacity: deleted ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {s.name}
                      {deleted && <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: 10, padding: '1px 6px' }}>Deleted</span>}
                    </h3>
                    {s.contactName && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{s.contactName}</p>}
                  </div>
                    {isAdmin && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {deleted ? (
                        <button onClick={() => handleRestore(s.id)} className="btn btn-ghost" style={{ padding: 8, minHeight: 'auto', minWidth: 'auto', color: 'var(--success)' }} title="Restore">
                          <RotateCcw style={{ width: 14, height: 14 }} />
                        </button>
                      ) : (
                      <>
                      <button onClick={() => openEdit(s)} className="btn btn-ghost" style={{ padding: 8, minHeight: 'auto', minWidth: 'auto' }}><Pencil style={{ width: 14, height: 14 }} /></button>
                      {deleteConfirm === s.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handleDelete(s.id)} style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(248,113,113,0.1)', color: 'var(--danger)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Del</button>
                          <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ padding: 8, minHeight: 'auto' }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(s.id)} className="btn btn-ghost" style={{ padding: 8, minHeight: 'auto', minWidth: 'auto' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
                      )}
                      </>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {s.email && <p style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}><Mail style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />{s.email}</p>}
                  {s.phone && <p style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}><Phone style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />{s.phone}</p>}
                </div>
              </div>
            )})}
          </div>
          <PaginationBar total={total} page={page} pageSize={pageSize} />
        </>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={closeModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-heading)' }}>{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button onClick={closeModal} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nike Corporation" />
                {errors.name && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.name}</p>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Contact Name</label>
                <input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Sales Rep" />
                {errors.contactName && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.contactName}</p>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Email</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="orders@nike.com" />
                  {errors.email && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.email}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Phone</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1-800-344-6453" />
                  {errors.phone && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.phone}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={closeModal} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save Changes' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
