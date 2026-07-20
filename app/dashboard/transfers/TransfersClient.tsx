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
  damagedQuantity: number
  status: string
  trackingNumber: string | null
  notes: string | null
  shippedAt: string | null
  receivedAt: string | null
  createdAt: string
  product: { id: string; name: string; sku: string }
  fromWarehouse: { id: string; name: string } | null
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

type Tab = 'incoming' | 'fulfill' | 'all'

export default function TransfersClient({ initialTransfers, products, warehouses, userRole, userWarehouseId }: Props) {
  const { showToast } = useToast()
  const [transfers, setTransfers] = useState<Transfer[]>(initialTransfers)
  const [tab, setTab] = useState<Tab>('incoming')
  const [search, setSearch] = useState('')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showAcceptModal, setShowAcceptModal] = useState<string | null>(null)
  const [showReceiveModal, setShowReceiveModal] = useState<string | null>(null)
  const [showShipModal, setShowShipModal] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [requestForm, setRequestForm] = useState({ productId: '', quantity: '', notes: '' })
  const [acceptForm, setAcceptForm] = useState({ fromWarehouseId: '' })
  const [receiveForm, setReceiveForm] = useState({ quantityReceived: '', damagedQuantity: '0', notes: '' })
  const [shipForm, setShipForm] = useState({ trackingNumber: '' })

  const isAdmin = userRole === 'ADMIN'
  const userWarehouseName = warehouses.find(w => w.id === userWarehouseId)?.name || ''

  const filtered = useMemo(() => {
    let list = transfers
    if (tab === 'incoming') {
      list = transfers.filter((t) => t.status === 'REQUESTED' && (isAdmin || t.toWarehouse.id === userWarehouseId))
    } else if (tab === 'fulfill') {
      list = transfers.filter((t) => t.status === 'REQUESTED' && t.toWarehouse.id !== userWarehouseId)
    } else {
      list = transfers.filter((t) => t.status !== 'REQUESTED')
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) => t.product.name.toLowerCase().includes(q) || t.product.sku.toLowerCase().includes(q) ||
          (t.fromWarehouse?.name ?? '').toLowerCase().includes(q) || t.toWarehouse.name.toLowerCase().includes(q)
      )
    }
    return list
  }, [transfers, tab, search, userWarehouseId, isAdmin])

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!requestForm.productId) {
      showToast('Please select a product', 'error')
      return
    }
    const qty = parseInt(requestForm.quantity)
    if (!qty || qty < 1) {
      showToast('Please enter a valid quantity', 'error')
      return
    }
    const destinationId = isAdmin ? warehouses[0]?.id : userWarehouseId
    if (!destinationId) {
      showToast('No warehouse assigned', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: requestForm.productId,
          toWarehouseId: destinationId,
          quantity: qty,
          notes: requestForm.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const t = data.transfer
      setTransfers((prev) => [{
        id: t.id,
        quantityInitiated: t.quantityInitiated,
        quantityReceived: 0,
        damagedQuantity: 0,
        status: 'REQUESTED',
        trackingNumber: null,
        notes: t.notes || null,
        shippedAt: null,
        receivedAt: null,
        createdAt: t.createdAt,
        product: { id: t.product.id, name: t.product.name, sku: t.product.sku },
        fromWarehouse: null,
        toWarehouse: { id: t.toWarehouse.id, name: t.toWarehouse.name },
        initiatedBy: { name: 'You' },
      }, ...prev])
      showToast('Transfer request created')
      setShowRequestModal(false)
      setRequestForm({ productId: '', quantity: '', notes: '' })
    } catch (err: any) {
      showToast(err.message || 'Failed to create request', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(transferId: string) {
    const sourceId = isAdmin ? acceptForm.fromWarehouseId : userWarehouseId
    if (!sourceId) {
      showToast('No warehouse assigned', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/v1/transfers/${transferId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromWarehouseId: sourceId }),
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
      showToast('Transfer accepted — stock deducted')
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
        body: JSON.stringify({ trackingNumber: shipForm.trackingNumber || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTransfers((prev) => prev.map((t) =>
        t.id === id ? { ...t, status: 'IN_TRANSIT', shippedAt: data.transfer.shippedAt, trackingNumber: data.transfer.trackingNumber } : t
      ))
      showToast('Transfer shipped')
      setShowShipModal(null)
      setShipForm({ trackingNumber: '' })
    } catch (err: any) {
      showToast(err.message || 'Failed to ship', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleReceive(id: string) {
    const qtyReceived = parseInt(receiveForm.quantityReceived)
    const damaged = parseInt(receiveForm.damagedQuantity) || 0
    if (!qtyReceived || qtyReceived < 1) {
      showToast('Enter valid quantity received', 'error')
      return
    }
    if (damaged > qtyReceived) {
      showToast('Damaged quantity cannot exceed received quantity', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/v1/transfers/${id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityReceived: qtyReceived,
          damagedQuantity: damaged,
          notes: receiveForm.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTransfers((prev) => prev.map((t) =>
        t.id === id ? { ...t, status: 'COMPLETED', quantityReceived: qtyReceived, damagedQuantity: damaged, receivedAt: data.transfer.receivedAt } : t
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

  const incomingCount = transfers.filter((t) => t.status === 'REQUESTED' && (isAdmin || t.toWarehouse.id === userWarehouseId)).length
  const fulfillCount = transfers.filter((t) => t.status === 'REQUESTED' && t.toWarehouse.id !== userWarehouseId).length
  const activeCount = transfers.filter((t) => t.status !== 'REQUESTED').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Transfers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {isAdmin ? `${transfers.length} total` : `${userWarehouseName} · ${transfers.length} total`}
          </p>
        </div>
        <button onClick={() => setShowRequestModal(true)} className="btn btn-primary" style={{ gap: 8 }}>
          <Plus style={{ width: 16, height: 16 }} />
          New Request
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {([
          { key: 'incoming' as Tab, label: 'Incoming Requests', count: incomingCount },
          { key: 'fulfill' as Tab, label: 'Accept & Fulfill', count: fulfillCount },
          { key: 'all' as Tab, label: 'In Progress', count: activeCount },
        ]).map((t) => (
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
          title={tab === 'incoming' ? 'No incoming requests' : tab === 'fulfill' ? 'No requests to fulfill' : 'No active transfers'}
          description={search ? 'Try a different search.' : tab === 'incoming' ? 'No one has requested stock for your warehouse yet.' : tab === 'fulfill' ? 'All requests have been fulfilled.' : 'Accepted transfers will appear here.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((t) => {
            const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.REQUESTED
            const isRequest = t.status === 'REQUESTED'
            const isIncoming = isRequest && t.toWarehouse.id === userWarehouseId
            const canFulfill = isRequest && t.toWarehouse.id !== userWarehouseId
            const canShip = !isRequest && t.status === 'PENDING' && (isAdmin || t.fromWarehouse?.id === userWarehouseId)
            const canReceive = !isRequest && t.status === 'IN_TRANSIT' && (isAdmin || t.toWarehouse.id === userWarehouseId)
            const canDownloadPackingSlip = !isRequest && (t.status === 'PENDING' || t.status === 'IN_TRANSIT') && (isAdmin || t.fromWarehouse?.id === userWarehouseId)
            const canDownloadReceivingReport = t.status === 'COMPLETED' && (isAdmin || t.toWarehouse.id === userWarehouseId)

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
                        {isIncoming && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)' }}>(your warehouse)</span>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span>{t.fromWarehouse?.name ?? '?'}</span>
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
                    {canDownloadPackingSlip && (
                      <TransferOrderDownload transfer={{
                        id: t.id, product: t.product, fromWarehouse: t.fromWarehouse,
                        toWarehouse: t.toWarehouse, quantityInitiated: t.quantityInitiated,
                        trackingNumber: t.trackingNumber, notes: t.notes, createdAt: t.createdAt, shippedAt: t.shippedAt,
                      }} />
                    )}
                    {canDownloadReceivingReport && (
                      <ReceivingReportDownload transfer={{
                        id: t.id, product: t.product, fromWarehouse: t.fromWarehouse,
                        toWarehouse: t.toWarehouse, quantityInitiated: t.quantityInitiated,
                        quantityReceived: t.quantityReceived, damagedQuantity: t.damagedQuantity,
                        receivedAt: t.receivedAt, notes: t.notes,
                      }} />
                    )}
                    {canFulfill && (
                      <button onClick={() => { setShowAcceptModal(t.id); setAcceptForm({ fromWarehouseId: userWarehouseId || '' }) }} className="btn btn-primary" style={{ gap: 6, fontSize: 13 }}>
                        <Hand style={{ width: 14, height: 14 }} />
                        Fulfill
                      </button>
                    )}
                    {canShip && (
                      <button onClick={() => { setShowShipModal(t.id); setShipForm({ trackingNumber: '' }) }} className="btn btn-primary" style={{ gap: 6, fontSize: 13 }}>
                        <Truck style={{ width: 14, height: 14 }} />
                        Ship
                      </button>
                    )}
                    {canReceive && (
                      <button onClick={() => { setShowReceiveModal(t.id); setReceiveForm({ quantityReceived: t.quantityInitiated.toString(), damagedQuantity: '0', notes: '' }) }} className="btn btn-primary" style={{ gap: 6, fontSize: 13 }}>
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
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Deliver to</label>
                {isAdmin ? (
                  <CustomSelect
                    options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                    value={warehouses[0]?.id || ''}
                    onChange={() => {}}
                    placeholder="Select warehouse..."
                  />
                ) : (
                  <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, color: 'var(--text-heading)' }}>
                    {userWarehouseName || 'No warehouse assigned'}
                  </div>
                )}
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
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>Fulfill Request</h2>
              <button onClick={() => setShowAcceptModal(null)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Stock will be deducted from {isAdmin ? 'the selected' : 'your'} warehouse and shipped to the requester.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleAccept(showAcceptModal) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isAdmin && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Ship from (source) *</label>
                  <CustomSelect
                    options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                    value={acceptForm.fromWarehouseId}
                    onChange={(v) => setAcceptForm({ ...acceptForm, fromWarehouseId: v })}
                    placeholder="Select warehouse..."
                    required
                  />
                </div>
              )}
              {!isAdmin && (
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, color: 'var(--text-heading)' }}>
                  Shipping from: <strong>{userWarehouseName}</strong>
                </div>
              )}
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

      {/* Ship Modal */}
      {showShipModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setShowShipModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>Ship Transfer</h2>
              <button onClick={() => setShowShipModal(null)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleShip(showShipModal) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Tracking Number (optional)</label>
                <input className="input" value={shipForm.trackingNumber} onChange={(e) => setShipForm({ ...shipForm, trackingNumber: e.target.value })} placeholder="e.g., 1Z999AA10123456784" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowShipModal(null)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Shipment'}
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
                <input className="input tabular" type="number" min="0" value={receiveForm.quantityReceived} onChange={(e) => setReceiveForm({ ...receiveForm, quantityReceived: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Damaged Quantity</label>
                <input className="input tabular" type="number" min="0" value={receiveForm.damagedQuantity} onChange={(e) => setReceiveForm({ ...receiveForm, damagedQuantity: e.target.value })} />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Damaged items will be written off from inventory.</p>
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
