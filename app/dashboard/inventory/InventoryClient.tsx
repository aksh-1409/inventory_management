'use client'

import { useState, useMemo } from 'react'
import { Package, Search, X, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'

interface InventoryItem {
  id: string
  quantity: number
  damaged: number
  productId: string
  warehouseId: string
  product: { id: string; sku: string; name: string; reorderPoint: number }
  warehouse: { id: string; name: string }
}

interface Props {
  initialItems: InventoryItem[]
  userRole: string
}

export default function InventoryClient({ initialItems, userRole }: Props) {
  const { showToast } = useToast()
  const [items, setItems] = useState<InventoryItem[]>(initialItems)
  const [search, setSearch] = useState('')
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [adjustForm, setAdjustForm] = useState({ delta: '', reason: '' })
  const [loading, setLoading] = useState(false)

  const isAdmin = userRole === 'ADMIN'

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(
      (item) =>
        item.product.name.toLowerCase().includes(q) ||
        item.product.sku.toLowerCase().includes(q) ||
        item.warehouse.name.toLowerCase().includes(q)
    )
  }, [items, search])

  function getStockColor(qty: number, reorderPoint: number) {
    if (qty <= reorderPoint) return 'var(--danger)'
    if (qty < reorderPoint * 2) return 'var(--warning)'
    return 'var(--success)'
  }

  function openAdjust(item: InventoryItem) {
    setAdjusting(item.id)
    setAdjustForm({ delta: '', reason: '' })
  }

  async function handleAdjust(itemId: string) {
    const delta = parseInt(adjustForm.delta)
    if (isNaN(delta) || delta === 0) {
      showToast('Please enter a valid number', 'error')
      return
    }
    if (!adjustForm.reason.trim()) {
      showToast('Please enter a reason', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: itemId,
          delta,
          reason: adjustForm.reason,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity + delta } : item
        )
      )
      showToast(`Stock adjusted by ${delta > 0 ? '+' : ''}${delta}`)
      setAdjusting(null)
      setAdjustForm({ delta: '', reason: '' })
    } catch (err: any) {
      showToast(err.message || 'Failed to adjust stock', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Inventory</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>{items.length} items across all warehouses</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by product name, SKU, or warehouse..."
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No inventory found"
          description={search ? 'Try a different search.' : 'Inventory is created when you receive stock.'}
        />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Warehouse</th>
                  <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stock</th>
                  <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Damaged</th>
                  <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reorder At</th>
                  <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  {isAdmin && <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Adjust</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const color = getStockColor(item.quantity, item.product.reorderPoint)
                  const status = item.quantity <= item.product.reorderPoint ? 'CRITICAL' : item.quantity < item.product.reorderPoint * 2 ? 'LOW' : 'HEALTHY'
                  const statusColor = item.quantity <= item.product.reorderPoint ? 'var(--danger)' : item.quantity < item.product.reorderPoint * 2 ? 'var(--warning)' : 'var(--success)'

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td data-label="Product" style={{ padding: '16px 24px' }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-heading)' }}>{item.product.name}</p>
                          <p className="tabular" style={{ fontSize: 12, color: 'var(--accent)' }}>{item.product.sku}</p>
                        </div>
                      </td>
                      <td data-label="Warehouse" style={{ padding: '16px 24px' }}>
                          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{item.warehouse.name}</span>
                      </td>
                      <td data-label="Stock" style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <span className="tabular" style={{ fontSize: 20, fontWeight: 600, color }}>{item.quantity}</span>
                      </td>
                      <td data-label="Damaged" style={{ padding: '16px 24px', textAlign: 'center' }}>
                        {item.damaged > 0 ? (
                          <span className="tabular" style={{ fontSize: 14, fontWeight: 500, color: 'var(--danger)' }}>{item.damaged}</span>
                        ) : (
                          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td data-label="Reorder At" style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <span className="tabular" style={{ fontSize: 14, color: 'var(--text-muted)' }}>{item.product.reorderPoint}</span>
                      </td>
                      <td data-label="Status" style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <span className="badge" style={{ background: `${statusColor}15`, color: statusColor }}>{status}</span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                          {adjusting === item.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', minWidth: 160 }}>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input
                                  className="input tabular"
                                  type="number"
                                  value={adjustForm.delta}
                                  onChange={(e) => setAdjustForm({ ...adjustForm, delta: e.target.value })}
                                  placeholder="+/-"
                                  style={{ width: 70, textAlign: 'center', padding: '4px 8px', minHeight: 'auto' }}
                                  autoFocus
                                />
                                <input
                                  className="input"
                                  value={adjustForm.reason}
                                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                  placeholder="Reason"
                                  style={{ width: 120, padding: '4px 8px', minHeight: 'auto', fontSize: 12 }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => handleAdjust(item.id)} disabled={loading} style={{ padding: '4px 8px', fontSize: 12, background: 'var(--success)', color: '#022c22', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                                </button>
                                <button onClick={() => setAdjusting(null)} style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => openAdjust(item)} className="btn btn-ghost" style={{ padding: '8px 12px', minHeight: 'auto', fontSize: 12, gap: 4 }}>
                              Adjust
                            </button>
                          )}
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
    </div>
  )
}
