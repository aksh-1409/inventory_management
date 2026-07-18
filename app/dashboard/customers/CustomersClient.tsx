'use client'

import { useState } from 'react'
import { ShoppingCart, Plus, Pencil, Trash2, X, Loader2, Mail, Phone } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'

interface CustomerData {
  id: string
  name: string
  email: string | null
  phone: string
  createdAt: string
}

interface Props {
  initialCustomers: CustomerData[]
  userRole: string
}

const emptyForm = { name: '', email: '', phone: '' }

export default function CustomersClient({ initialCustomers, userRole }: Props) {
  const { showToast } = useToast()
  const [customers, setCustomers] = useState<CustomerData[]>(initialCustomers)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CustomerData | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  function openCreate() { setEditing(null); setForm(emptyForm); setShowModal(true) }
  function openEdit(c: CustomerData) { setEditing(c); setForm({ name: c.name, email: c.email || '', phone: c.phone }); setShowModal(true) }
  function closeModal() { setShowModal(false); setEditing(null); setForm(emptyForm) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = { name: form.name, email: form.email || null, phone: form.phone }
    try {
      if (editing) {
        const res = await fetch(`/api/v1/customers/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setCustomers((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...data.customer } : c)))
        showToast('Customer updated')
      } else {
        const res = await fetch('/api/v1/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setCustomers((prev) => [...prev, { ...data.customer, createdAt: data.customer.createdAt }])
        showToast('Customer created')
      }
      closeModal()
    } catch (err: any) { showToast(err.message || 'Something went wrong', 'error') }
    finally { setLoading(false) }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/v1/customers/${id}`, { method: 'DELETE' })
      if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
      setCustomers((prev) => prev.filter((c) => c.id !== id))
      showToast('Customer deleted')
      setDeleteConfirm(null)
    } catch (err: any) { showToast(err.message || 'Failed to delete', 'error') }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Customers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{customers.length} customers</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}><Plus style={{ width: 16, height: 16 }} />Add Customer</button>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No customers yet" description="Customers are created automatically when you process sales." />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td data-label="Name" style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-heading)' }}>{c.name}</span>
                    </td>
                    <td data-label="Phone" style={{ padding: '16px 24px' }}>
                      <span className="tabular" style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />{c.phone}
                      </span>
                    </td>
                    <td data-label="Email" style={{ padding: '16px 24px' }}>
                      {c.email ? (
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />{c.email}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => openEdit(c)} className="btn btn-ghost" style={{ padding: 6, minHeight: 'auto', minWidth: 'auto' }}><Pencil style={{ width: 14, height: 14 }} /></button>
                        {deleteConfirm === c.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleDelete(c.id)} style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(248,113,113,0.1)', color: 'var(--danger)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Del</button>
                            <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto' }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(c.id)} className="btn btn-ghost" style={{ padding: 6, minHeight: 'auto', minWidth: 'auto' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={closeModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>{editing ? 'Edit Customer' : 'New Customer'}</h2>
              <button onClick={closeModal} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Phone *</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-000-0001" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={closeModal} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
