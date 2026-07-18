'use client'

import { useState, useMemo } from 'react'
import { ArrowLeftRight, Plus, Search, X, Loader2, Truck, CheckCircle, Package, Hand } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { TransferOrderDownload, ReceivingReportDownload } from '@/components/pdf/TransferPDFs'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface Transfer {
  id: string
  quantityInitiated: number
  quantityReceived: number
  status: string
  trackingNumber: string | null
  notes: string | null
  shippedAt: string | null
  receivedAt: string | null
  createdAt: string
  product: { id: string; name: string; sku: string }
  fromWarehouse: { id: string; name: string }
  toWarehouse: { id: string; name: string }
  initiatedBy: { name: string } | null
}

interface Product { id: string; name: string; sku: string }
interface Warehouse { id: string; name: string }

interface Props {
  initialTransfers: Transfer[]
  products: Product[]
  warehouses: Warehouse[]
  userRole: string
  userWarehouseId: string | null
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  REQUESTED: { color: 'var(--accent)', bg: 'rgba(99,102,241,0.12)' },
  PENDING: { color: 'var(--warning)', bg: 'rgba(251,191,36,0.12)' },
  IN_TRANSIT: { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  COMPLETED: { color: 'var(--success)', bg: 'rgba(52,211,153,0.12)' },
  CANCELLED: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)' },
}

type Tab = 'requests' | 'my-transfers' | 'accept'

export default function TransfersClient({ initialTransfers, products, warehouses, userRole, userWarehouseId }: Props) {
  const { showToast } = useToast()
  const [transfers, setTransfers] = useState<Transfer[]>(initialTransfers)
  const [tab, setTab] = useState<Tab>('requests')
  const [search, setSearch] = useState('')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showAcceptModal, setShowAcceptModal] = useState<string | null>(null)
  const [showReceiveModal, setShowReceiveModal] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [requestForm, setRequestForm] = useState({ productId: '', toWarehouseId: '', quantity: '', notes: '' })
  const [acceptForm, setAcceptForm] = useState({ fromWarehouseId: '' })
  const [receiveForm, setReceiveForm] = useState({ quantityReceived: '', damagedQuantity: '0', notes: '' })

  const isAdmin = userRole === 'ADMIN'

  const filtered = useMemo(() => {
    let list = transfers
    if (tab === 'requests') {
      list = transfers.filter((t) => t.status === 'REQUESTED')
    } else if (tab === 'my-transfers') {
      list = transfers.filter((t) => t.status !== 'REQUESTED')
    } else if (tab === 'accept') {
      list = transfers.filter((t) => t.status === 'REQUESTED' && t.toWarehouse.id !== userWarehouseId)
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) => t.product.name.toLowerCase().includes(q) || t.product.sku.toLowerCase().includes(q) ||
          t.fromWarehouse.name.toLowerCase().includes(q) || t.toWarehouse.name.toLowerCase().includes(q)
      )
    }
    return list
  }, [transfers, tab, search, userWarehouseId])

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!requestForm.productId || !requestForm.toWarehouseId) {
      showToast('Please select both product and warehouse', 'error')
      return
    }
    setLoading(true)
    try {
      const payload = {
        productId: requestForm.productId,
        toWarehouseId: requestForm.toWarehouseId,
        quantity: parseInt(requestForm.quantity),
        notes: requestForm.notes || undefined,
      }
      console.log('[TRANSFER_REQUEST]', JSON.stringify(payload))
      const res = await fetch('/api/v1/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const t = data.transfer
      setTransfers((prev) => [{
        id: t.id,
        quantityInitiated: t.quantityInitiated,
        quantityReceived: 0,
        status: t.status,
        trackingNumber: null,
        notes: t.notes,
        shippedAt: null,
        receivedAt: null,
        createdAt: t.createdAt,
        product: { id: t.product.id, name: t.product.name, sku: t.product.sku },
        fromWarehouse: { id: t.toWarehouse.id, name: t.toWarehouse.name },
        toWarehouse: { id: t.toWarehouse.id, name: t.toWarehouse.name },
        initiatedBy: { name: 'You' },
      }, ...prev])
      showToast('Transfer request created')
      setShowRequestModal(false)
      setRequestForm({ productId: '', toWarehouseId: '', quantity: '', notes: '' })
    } catch (err: any) {
      showToast(err.message || 'Failed to create request', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(transferId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/transfers/${transferId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromWarehouseId: acceptForm.fromWarehouseId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const t = data.transfer
      setTransfers((prev) => prev.map((tr) =>
        tr.id === transferId ? {
          ...tr,
          status: 'PENDING',
          fromWarehouse: { id: t.fromWarehouse.id, name: t.fromWarehouse.name },
        } : tr
      ))
      showToast('Transfer accepted — stock deducted from your warehouse')
      setShowAcceptModal(null)
      setAcceptForm({ fromWarehouseId: '' })
    } catch (err: any) {
      showToast(err.message || 'Failed to accept', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleShip(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/transfers/${id}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTransfers((prev) => prev.map((t) =>
        t.id === id ? { ...t, status: 'IN_TRANSIT', shippedAt: data.transfer.shippedAt } : t
      ))
      showToast('Transfer shipped')
    } catch (err: any) {
      showToast(err.message || 'Failed to ship', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleReceive(id: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/transfers/${id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityReceived: parseInt(receiveForm.quantityReceived),
          damagedQuantity: parseInt(receiveForm.damagedQuantity) || 0,
          notes: receiveForm.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTransfers((prev) => prev.map((t) =>
        t.id === id ? { ...t, status: 'COMPLETED', quantityReceived: parseInt(receiveForm.quantityReceived), receivedAt: data.transfer.receivedAt } : t
      ))
      showToast('Transfer received')
      setShowReceiveModal(null)
      setReceiveForm({ quantityReceived: '', damagedQuantity: '0', notes: '' })
    } catch (err: any) {
      showToast(err.message || 'Failed to receive', 'error')
    } finally {
      setLoading(false)
    }
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'requests', label: 'Open Requests', count: transfers.filter((t) => t.status === 'REQUESTED').length },
    { key: 'my-transfers', label: 'My Transfers', count: transfers.filter((t) => t.status !== 'REQUESTED').length },
    { key: 'accept', label: 'Accept & Fulfill', count: transfers.filter((t) => t.status === 'REQUESTED' && t.toWarehouse.id !== userWarehouseId).length },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Transfers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{transfers.length} total</p>
        </div>
        <button onClick={() => setShowRequestModal(true)} className="btn btn-primary" style={{ gap: 8 }}>
          <Plus style={{ width: 16, height: 16 }} />
          New Request
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--text-heading)' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 150ms ease',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.06)' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
        <input type="text" placeholder="Search transfers..." value={search} onChange={(e) => setSearch(e.target.value)} className="input" style={{ paddingLeft: 36 }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={tab === 'accept' ? 'No requests to accept' : tab === 'requests' ? 'No open requests' : 'No transfers yet'}
          description={search ? 'Try a different search.' : tab === 'accept' ? 'All requests in your warehouse are fulfilled.' : 'Create a transfer request to get started.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((t) => {
            const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.REQUESTED
            const isRequest = t.status === 'REQUESTED'
            const canAccept = isRequest && t.toWarehouse.id !== userWarehouseId
            const canShip = !isRequest && t.status === 'PENDING'
            const canReceive = !isRequest && t.status === 'IN_TRANSIT'

            return (
              <div key={t.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span className="badge" style={{ background: sc.bg, color: sc.color }}>{t.status}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                      {t.initiatedBy && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {t.initiatedBy.name}</span>
                      )}
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 4 }}>{t.product.name}</h3>
                    <p className="tabular" style={{ fontSize: 12, color: 'var(--accent)' }}>{t.product.sku}</p>

                    {isRequest ? (
                      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span>Needs </span>
                        <span className="tabular" style={{ fontWeight: 600, color: 'var(--text-heading)' }}>x{t.quantityInitiated}</span>
                        <span> at </span>
                        <span style={{ fontWeight: 500 }}>{t.toWarehouse.name}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span>{t.fromWarehouse.name}</span>
                        <ArrowLeftRight style={{ width: 12, height: 12 }} />
                        <span>{t.toWarehouse.name}</span>
                        <span className="tabular" style={{ fontWeight: 600, color: 'var(--text-heading)' }}>x{t.quantityInitiated}</span>
                      </div>
                    )}

                    {t.trackingNumber && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Tracking: {t.trackingNumber}</p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                    {!isRequest && (t.status === 'PENDING' || t.status === 'IN_TRANSIT') && (
                      <TransferOrderDownload transfer={{
                        id: t.id, product: t.product, fromWarehouse: t.fromWarehouse,
                        toWarehouse: t.toWarehouse, quantityInitiated: t.quantityInitiated,
                        trackingNumber: t.trackingNumber, notes: t.notes, createdAt: t.createdAt, shippedAt: t.shippedAt,
                      }} />
                    )}
                    {t.status === 'COMPLETED' && (
                      <ReceivingReportDownload transfer={{
                        id: t.id, product: t.product, fromWarehouse: t.fromWarehouse,
                        toWarehouse: t.toWarehouse, quantityInitiated: t.quantityInitiated,
                        quantityReceived: t.quantityReceived, receivedAt: t.receivedAt, notes: t.notes,
                      }} />
                    )}
                    {canAccept && (
                      <button onClick={() => { setShowAcceptModal(t.id); setAcceptForm({ fromWarehouseId: userWarehouseId || '' }) }} className="btn btn-primary" style={{ gap: 6, fontSize: 13 }}>
                        <Hand style={{ width: 14, height: 14 }} />
                        Accept
                      </button>
                    )}
                    {canShip && (
                      <button onClick={() => handleShip(t.id)} disabled={loading} className="btn btn-primary" style={{ gap: 6, fontSize: 13 }}>
                        <Truck style={{ width: 14, height: 14 }} />
                        Ship
                      </button>
                    )}
                    {canReceive && (
                      <button onClick={() => { setShowReceiveModal(t.id); setReceiveForm({ ...receiveForm, quantityReceived: t.quantityInitiated.toString() }) }} className="btn btn-primary" style={{ gap: 6, fontSize: 13 }}>
                        <CheckCircle style={{ width: 14, height: 14 }} />
                        Receive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setShowRequestModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 480, borderRadius: 12, border: '1px solid var(--border)', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>New Transfer Request</h2>
              <button onClick={() => setShowRequestModal(false)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Product *</label>
                <CustomSelect
                  options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
                  value={requestForm.productId}
                  onChange={(v) => setRequestForm({ ...requestForm, productId: v })}
                  placeholder="Select product..."
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>I need this at (my warehouse) *</label>
                <CustomSelect
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                  value={requestForm.toWarehouseId}
                  onChange={(v) => setRequestForm({ ...requestForm, toWarehouseId: v })}
                  placeholder="Select warehouse..."
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Quantity *</label>
                <input className="input tabular" type="number" min="1" value={requestForm.quantity} onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</label>
                <input className="input" value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} placeholder="Optional..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowRequestModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accept Modal */}
      {showAcceptModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setShowAcceptModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>Accept Transfer Request</h2>
              <button onClick={() => setShowAcceptModal(null)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Select the warehouse that will fulfill this request. Stock will be deducted from that warehouse.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleAccept(showAcceptModal) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Ship from (source warehouse) *</label>
                <CustomSelect
                  options={warehouses.filter((w) => w.id !== userWarehouseId).map((w) => ({ value: w.id, label: w.name }))}
                  value={acceptForm.fromWarehouseId}
                  onChange={(v) => setAcceptForm({ ...acceptForm, fromWarehouseId: v })}
                  placeholder="Select warehouse..."
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowAcceptModal(null)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept & Deduct Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setShowReceiveModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>Receive Transfer</h2>
              <button onClick={() => setShowReceiveModal(null)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleReceive(showReceiveModal) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Quantity Received *</label>
                <input className="input tabular" type="number" min="1" value={receiveForm.quantityReceived} onChange={(e) => setReceiveForm({ ...receiveForm, quantityReceived: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Damaged Quantity</label>
                <input className="input tabular" type="number" min="0" value={receiveForm.damagedQuantity} onChange={(e) => setReceiveForm({ ...receiveForm, damagedQuantity: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</label>
                <input className="input" value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} placeholder="Optional..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowReceiveModal(null)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Receive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
