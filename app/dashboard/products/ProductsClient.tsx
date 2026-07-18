'use client'

import { useState, useMemo } from 'react'
import { Package, Plus, Pencil, Trash2, Search, X, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'

interface InventoryEntry {
  id: string
  quantity: number
  warehouse: { id: string; name: string }
}

interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  price: number
  costPrice: number | null
  reorderPoint: number
  category: string | null
  createdAt: string
  inventoryItems: InventoryEntry[]
}

interface Warehouse {
  id: string
  name: string
}

interface Props {
  initialProducts: Product[]
  warehouses: Warehouse[]
  userRole: string
}

const emptyForm = {
  sku: '',
  name: '',
  description: '',
  price: '',
  costPrice: '',
  reorderPoint: '5',
  category: '',
}

export default function ProductsClient({ initialProducts, warehouses, userRole }: Props) {
  const { showToast } = useToast()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const isAdmin = userRole === 'ADMIN'

  const filtered = useMemo(() => {
    if (!search) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    )
  }, [products, search])

  function openCreate() {
    setEditingProduct(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      costPrice: product.costPrice?.toString() || '',
      reorderPoint: product.reorderPoint.toString(),
      category: product.category || '',
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingProduct(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
      reorderPoint: parseInt(form.reorderPoint) || 5,
      category: form.category || null,
    }

    try {
      if (editingProduct) {
        const res = await fetch(`/api/v1/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? { ...p, ...data.product } : p))
        )
        showToast('Product updated successfully')
      } else {
        const res = await fetch('/api/v1/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setProducts((prev) => [...prev, { ...data.product, inventoryItems: [], createdAt: data.product.createdAt }])
        showToast('Product created successfully')
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
      const res = await fetch(`/api/v1/products/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setProducts((prev) => prev.filter((p) => p.id !== id))
      showToast('Product deleted')
      setDeleteConfirm(null)
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error')
    }
  }

  function getTotalStock(product: Product) {
    return product.inventoryItems.reduce((sum, item) => sum + item.quantity, 0)
  }

  function getStockByWarehouse(product: Product, warehouseId: string) {
    const item = product.inventoryItems.find((i) => i.warehouse.id === warehouseId)
    return item?.quantity || 0
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Products</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{products.length} products in catalog</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}>
            <Plus style={{ width: 16, height: 16 }} />
            Add Product
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by name, SKU, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ paddingLeft: 36 }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={search ? 'Try a different search term.' : 'Add your first product to get started.'}
          actionLabel={isAdmin && !search ? 'Add Product' : undefined}
          onAction={isAdmin && !search ? openCreate : undefined}
        />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SKU</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</th>
                  {warehouses.map((w) => (
                    <th key={w.id} style={{ padding: '16px 24px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{w.name}</th>
                  ))}
                  <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</th>
                  {isAdmin && <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const total = getTotalStock(product)
                  return (
                    <tr key={product.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td data-label="Product" style={{ padding: '16px 24px' }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-heading)' }}>{product.name}</p>
                          {product.category && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.category}</p>}
                        </div>
                      </td>
                      <td data-label="SKU" style={{ padding: '16px 24px' }}>
                        <span className="tabular" style={{ fontSize: 13, color: 'var(--accent)' }}>{product.sku}</span>
                      </td>
                      <td data-label="Price" style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <span className="tabular" style={{ fontSize: 14, fontWeight: 500 }}>${product.price.toFixed(2)}</span>
                      </td>
                      {warehouses.map((w) => {
                        const qty = getStockByWarehouse(product, w.id)
                        const color = qty <= product.reorderPoint ? 'var(--danger)' : qty < product.reorderPoint * 2 ? 'var(--warning)' : 'var(--success)'
                        return (
                          <td key={w.id} data-label={w.name} style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color }}>{qty}</span>
                          </td>
                        )
                      })}
                      <td data-label="Total" style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-heading)' }}>{total}</span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button onClick={() => openEdit(product)} className="btn btn-ghost" style={{ padding: '6px 8px', minHeight: 'auto', minWidth: 'auto' }} title="Edit">
                              <Pencil style={{ width: 14, height: 14 }} />
                            </button>
                            {deleteConfirm === product.id ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <button onClick={() => handleDelete(product.id)} className="btn btn-danger" style={{ padding: '6px 10px', minHeight: 'auto', fontSize: 12, background: 'rgba(248,113,113,0.1)', color: 'var(--danger)' }}>Delete</button>
                                <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ padding: '6px 8px', minHeight: 'auto' }}>Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirm(product.id)} className="btn btn-ghost" style={{ padding: '6px 8px', minHeight: 'auto', minWidth: 'auto' }} title="Delete">
                                <Trash2 style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={closeModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 480, borderRadius: 12, border: '1px solid var(--border)', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>{editingProduct ? 'Edit Product' : 'New Product'}</h2>
              <button onClick={closeModal} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>SKU *</label>
                  <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="AM-90-WHT-10" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Name *</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Air Max 90" required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</label>
                <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Classic Nike Air Max 90 in white, size 10" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Price *</label>
                  <input className="input tabular" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="120.00" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Cost Price</label>
                  <input className="input tabular" type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="65.00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Reorder Point</label>
                  <input className="input tabular" type="number" min="0" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} placeholder="5" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Category</label>
                <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Sneakers" />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={closeModal} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
