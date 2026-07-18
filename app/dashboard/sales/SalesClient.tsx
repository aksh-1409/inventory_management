'use client'

import { useState, useMemo } from 'react'
import { ShoppingCart, Plus, Search, X, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface Sale {
  id: string
  delta: number
  reference: string | null
  createdAt: string
  product: { id: string; name: string; sku: string }
  warehouse: { id: string; name: string }
}

interface Product { id: string; name: string; sku: string; price: number }
interface Warehouse { id: string; name: string }
interface Customer { id: string; name: string }

interface Props {
  initialSales: Sale[]
  products: Product[]
  warehouses: Warehouse[]
  customers: Customer[]
  userRole: string
}

export default function SalesClient({ initialSales, products, warehouses, customers, userRole }: Props) {
  const { showToast } = useToast()
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ productId: '', warehouseId: '', customerId: '', quantity: '', unitPrice: '', notes: '' })

  const isAdmin = userRole === 'ADMIN'

  const filtered = useMemo(() => {
    if (!search) return sales
    const q = search.toLowerCase()
    return sales.filter(
      (s) => s.product.name.toLowerCase().includes(q) || s.product.sku.toLowerCase().includes(q) || s.warehouse.name.toLowerCase().includes(q)
    )
  }, [sales, search])

  function openCreate() {
    setForm({ productId: '', warehouseId: '', customerId: '', quantity: '', unitPrice: '', notes: '' })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/v1/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          warehouseId: form.warehouseId,
          customerId: form.customerId,
          quantity: parseInt(form.quantity),
          unitPrice: parseFloat(form.unitPrice),
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const product = products.find((p) => p.id === form.productId)!
      const warehouse = warehouses.find((w) => w.id === form.warehouseId)!
      setSales((prev) => [{
        id: data.sale.id,
        delta: -parseInt(form.quantity),
        reference: form.notes || 'Sale to customer',
        createdAt: data.sale.createdAt,
        product: { id: product.id, name: product.name, sku: product.sku },
        warehouse: { id: warehouse.id, name: warehouse.name },
      }, ...prev])
      showToast(`Sale recorded: ${parseInt(form.quantity)} units`)
      setShowModal(false)
    } catch (err: any) {
      showToast(err.message || 'Failed to record sale', 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectedProduct = products.find((p) => p.id === form.productId)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Sales</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{sales.length} recorded sales</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}>
            <Plus style={{ width: 16, height: 16 }} />
            Record Sale
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
        <input type="text" placeholder="Search sales..." value={search} onChange={(e) => setSearch(e.target.value)} className="input" style={{ paddingLeft: 36 }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No sales yet" description={search ? 'Try a different search.' : 'Record your first sale to get started.'} />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Product', 'SKU', 'Warehouse', 'Qty', 'Date', 'Reference'].map((h) => (
                    <th key={h} style={{ padding: '16px 24px', textAlign: h === 'Qty' ? 'center' : 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale) => (
                  <tr key={sale.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td data-label="Product" style={{ padding: '16px 24px' }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-heading)' }}>{sale.product.name}</p>
                    </td>
                    <td data-label="SKU" style={{ padding: '16px 24px' }}>
                      <span className="tabular" style={{ fontSize: 13, color: 'var(--accent)' }}>{sale.product.sku}</span>
                    </td>
                    <td data-label="Warehouse" style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{sale.warehouse.name}</span>
                    </td>
                    <td data-label="Qty" style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>{sale.delta}</span>
                    </td>
                    <td data-label="Date" style={{ padding: '16px 24px' }}>
                      <span className="tabular" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(sale.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td data-label="Reference" style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{sale.reference || '-'}</span>
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
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 480, borderRadius: 12, border: '1px solid var(--border)', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>Record Sale</h2>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Product *</label>
                <CustomSelect
                  options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
                  value={form.productId}
                  onChange={(v) => setForm({ ...form, productId: v })}
                  placeholder="Select product..."
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Warehouse *</label>
                  <CustomSelect
                    options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                    value={form.warehouseId}
                    onChange={(v) => setForm({ ...form, warehouseId: v })}
                    placeholder="Select..."
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Customer *</label>
                  <CustomSelect
                    options={customers.map((c) => ({ value: c.id, label: c.name }))}
                    value={form.customerId}
                    onChange={(v) => setForm({ ...form, customerId: v })}
                    placeholder="Select..."
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Quantity *</label>
                  <input className="input tabular" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Unit Price *</label>
                  <input className="input tabular" type="number" step="0.01" min="0" value={form.unitPrice || (selectedProduct?.price || '')} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</label>
                <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
