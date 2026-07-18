'use client'

import { useState } from 'react'
import { Warehouse, Plus, Pencil, Trash2, X, Loader2, MapPin } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'

interface WarehouseItem {
  id: string
  quantity: number
  product: { id: string; name: string; sku: string }
}

interface WarehouseData {
  id: string
  name: string
  location: string | null
  createdAt: string
  inventoryItems: WarehouseItem[]
  totalProducts: number
  totalStock: number
}

interface Props {
  initialWarehouses: WarehouseData[]
  userRole: string
}

export default function WarehousesClient({ initialWarehouses, userRole }: Props) {
  const { showToast } = useToast()
  const [warehouses, setWarehouses] = useState<WarehouseData[]>(initialWarehouses)
  const [showModal, setShowModal] = useState(false)
  const [editingWH, setEditingWH] = useState<WarehouseData | null>(null)
  const [form, setForm] = useState({ name: '', location: '' })
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const isAdmin = userRole === 'ADMIN'

  function openCreate() {
    setEditingWH(null)
    setForm({ name: '', location: '' })
    setShowModal(true)
  }

  function openEdit(wh: WarehouseData) {
    setEditingWH(wh)
    setForm({ name: wh.name, location: wh.location || '' })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingWH(null)
    setForm({ name: '', location: '' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const payload = { name: form.name, location: form.location || null }

    try {
      if (editingWH) {
        const res = await fetch(`/api/v1/warehouses/${editingWH.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setWarehouses((prev) =>
          prev.map((w) => (w.id === editingWH.id ? { ...w, ...data.warehouse } : w))
        )
        showToast('Warehouse updated')
      } else {
        const res = await fetch('/api/v1/warehouses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setWarehouses((prev) => [
          ...prev,
          { ...data.warehouse, inventoryItems: [], totalProducts: 0, totalStock: 0, createdAt: data.warehouse.createdAt },
        ])
        showToast('Warehouse created')
      }
      closeModal()
    } catch (err: any) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/v1/warehouses/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setWarehouses((prev) => prev.filter((w) => w.id !== id))
      showToast('Warehouse deleted')
      setDeleteConfirm(null)
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Warehouses</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{warehouses.length} locations</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}>
            <Plus style={{ width: 16, height: 16 }} />
            Add Warehouse
          </button>
        )}
      </div>

      {warehouses.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="No warehouses yet"
          description="Add your first warehouse location to start tracking inventory."
          actionLabel={isAdmin ? 'Add Warehouse' : undefined}
          onAction={isAdmin ? openCreate : undefined}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {warehouses.map((wh) => (
            <div key={wh.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 4 }}>{wh.name}</h3>
                  {wh.location && (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin style={{ width: 12, height: 12 }} />{wh.location}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(wh)} className="btn btn-ghost" style={{ padding: 6, minHeight: 'auto', minWidth: 'auto' }}>
                      <Pencil style={{ width: 14, height: 14 }} />
                    </button>
                    {deleteConfirm === wh.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleDelete(wh.id)} style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(248,113,113,0.1)', color: 'var(--danger)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Delete</button>
                        <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto' }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(wh.id)} className="btn btn-ghost" style={{ padding: 6, minHeight: 'auto', minWidth: 'auto' }}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="surface-0" style={{ padding: '12px 16px', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Products</p>
                  <p className="tabular" style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>{wh.totalProducts}</p>
                </div>
                <div className="surface-0" style={{ padding: '12px 16px', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Stock</p>
                  <p className="tabular" style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>{wh.totalStock}</p>
                </div>
              </div>

              {wh.inventoryItems.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Stock Breakdown</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {wh.inventoryItems.slice(0, 5).map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.product.name}</span>
                        <span className="tabular" style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{item.quantity}</span>
                      </div>
                    ))}
                    {wh.inventoryItems.length > 5 && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{wh.inventoryItems.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={closeModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>{editingWH ? 'Edit Warehouse' : 'New Warehouse'}</h2>
              <button onClick={closeModal} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="NYC Flagship" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Location</label>
                <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="New York City, NY" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={closeModal} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingWH ? 'Save Changes' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
