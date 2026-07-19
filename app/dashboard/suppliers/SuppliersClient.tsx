'use client'

import { useState } from 'react'
import { Truck, Plus, Pencil, Trash2, X, Loader2, Mail, Phone } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'

interface SupplierData {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  createdAt: string
}

interface Props {
  initialSuppliers: SupplierData[]
  userRole: string
}

const emptyForm = { name: '', contactName: '', email: '', phone: '' }

export default function SuppliersClient({ initialSuppliers, userRole }: Props) {
  const { showToast } = useToast()
  const [suppliers, setSuppliers] = useState<SupplierData[]>(initialSuppliers)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SupplierData | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const isAdmin = userRole === 'ADMIN'

  function openCreate() { setEditing(null); setForm(emptyForm); setShowModal(true) }
  function openEdit(s: SupplierData) { setEditing(s); setForm({ name: s.name, contactName: s.contactName || '', email: s.email || '', phone: s.phone || '' }); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditing(null); setForm(emptyForm) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = { name: form.name, contactName: form.contactName || null, email: form.email || null, phone: form.phone || null }
    try {
      if (editing) {
        const res = await fetch(`/api/v1/suppliers/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setSuppliers((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...data.supplier } : s)))
        showToast('Supplier updated')
      } else {
        const res = await fetch('/api/v1/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setSuppliers((prev) => [...prev, { ...data.supplier, createdAt: data.supplier.createdAt }])
        showToast('Supplier created')
      }
      closeModal()
    } catch (err: any) { showToast(err.message || 'Something went wrong', 'error') }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/v1/suppliers/${id}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
      setSuppliers((prev) => prev.filter((s) => s.id !== id))
      showToast('Supplier deleted')
      setDeleteConfirm(null)
    } catch (err: any) { showToast(err.message || 'Failed to delete', 'error') }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Suppliers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{suppliers.length} suppliers</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}><Plus style={{ width: 16, height: 16 }} />Add Supplier</button>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers yet" description="Add your first supplier to track who sends your inventory." actionLabel="Add Supplier" onAction={openCreate} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {suppliers.map((s) => (
            <div key={s.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 2 }}>{s.name}</h3>
                  {s.contactName && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.contactName}</p>}
                </div>
                  {isAdmin && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(s)} className="btn btn-ghost" style={{ padding: 6, minHeight: 'auto', minWidth: 'auto' }}><Pencil style={{ width: 14, height: 14 }} /></button>
                    {deleteConfirm === s.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleDelete(s.id)} style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(248,113,113,0.1)', color: 'var(--danger)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Del</button>
                        <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto' }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(s.id)} className="btn btn-ghost" style={{ padding: 6, minHeight: 'auto', minWidth: 'auto' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.email && <p style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><Mail style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />{s.email}</p>}
                {s.phone && <p style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><Phone style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />{s.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={closeModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button onClick={closeModal} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nike Corporation" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Contact Name</label>
                <input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Sales Rep" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Email</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="orders@nike.com" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Phone</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1-800-344-6453" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={closeModal} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save Changes' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
