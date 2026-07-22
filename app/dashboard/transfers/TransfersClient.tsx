'use client'

import { useState, useEffect, useMemo, useOptimistic, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeftRight, Plus, X, Loader2, Truck, CheckCircle, Hand } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { CursorPagination } from '@/components/ui/CursorPagination'
import { useToast } from '@/components/ui/Toast'
import { TransferOrderDownload, ReceivingReportDownload } from '@/components/pdf/TransferPDFs'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { transferRequestSchema, transferShipSchema, transferReceiveSchema } from '@/lib/schemas'

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
  total?: number
  page?: number
  pageSize?: number
  totalCount?: number
  nextCursor?: string | null
  hasMore?: boolean
  products: Product[]
  warehouses: Warehouse[]
  userRole: string
  userWarehouseId: string | null
}

type OptimisticAction =
  | { type: 'create'; transfer: Transfer }
  | { type: 'accept'; id: string; fromWarehouse: { id: string; name: string } }
  | { type: 'ship'; id: string; trackingNumber: string | null; shippedAt: string }
  | { type: 'receive'; id: string; quantityReceived: number; damagedQuantity: number; receivedAt: string }

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  REQUESTED: { color: 'var(--accent)', bg: 'rgba(99,102,241,0.12)' },
  PENDING: { color: 'var(--warning)', bg: 'rgba(251,191,36,0.12)' },
  IN_TRANSIT: { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  COMPLETED: { color: 'var(--success)', bg: 'rgba(52,211,153,0.12)' },
  CANCELLED: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)' },
}

type Tab = 'incoming' | 'fulfill' | 'all'

export default function TransfersClient({ initialTransfers, total, page, pageSize, totalCount, nextCursor: initialNextCursor, hasMore: initialHasMore, products, warehouses, userRole, userWarehouseId }: Props) {
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const qParam = searchParams.get('q') || ''
  const cursorMode = initialNextCursor !== undefined
  const [isPending, startTransition] = useTransition()
  const [transfers, setTransfers] = useState<Transfer[]>(initialTransfers)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null)
  const [hasMore, setHasMore] = useState(initialHasMore ?? false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [optimisticTransfers, addOptimistic] = useOptimistic(transfers, (state, action: OptimisticAction) => {
    switch (action.type) {
      case 'create':
        return [action.transfer, ...state]
      case 'accept':
        return state.map((t) =>
          t.id === action.id ? { ...t, status: 'PENDING', fromWarehouse: action.fromWarehouse } : t
        )
      case 'ship':
        return state.map((t) =>
          t.id === action.id ? { ...t, status: 'IN_TRANSIT', trackingNumber: action.trackingNumber, shippedAt: action.shippedAt } : t
        )
      case 'receive':
        return state.map((t) =>
          t.id === action.id ? { ...t, status: 'COMPLETED', quantityReceived: action.quantityReceived, damagedQuantity: action.damagedQuantity, receivedAt: action.receivedAt } : t
        )
      default: return state
    }
  })
  const [tab, setTab] = useState<Tab>('incoming')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showAcceptModal, setShowAcceptModal] = useState<string | null>(null)
  const [showReceiveModal, setShowReceiveModal] = useState<string | null>(null)
  const [showShipModal, setShowShipModal] = useState<string | null>(null)

  const [requestForm, setRequestForm] = useState({ productId: '', quantity: '', notes: '' })
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({})
  const [acceptForm, setAcceptForm] = useState({ fromWarehouseId: '' })
  const [receiveForm, setReceiveForm] = useState({ quantityReceived: '', damagedQuantity: '0', notes: '' })
  const [receiveErrors, setReceiveErrors] = useState<Record<string, string>>({})
  const [shipForm, setShipForm] = useState({ trackingNumber: '' })
  const [shipErrors, setShipErrors] = useState<Record<string, string>>({})

  const isAdmin = userRole === 'ADMIN'
  const userWarehouseName = warehouses.find(w => w.id === userWarehouseId)?.name || ''

  useEffect(() => {
    setTransfers(initialTransfers)
    if (cursorMode) {
      setNextCursor(initialNextCursor ?? null)
      setHasMore(initialHasMore ?? false)
    }
  }, [initialTransfers])

  const tabbed = useMemo(() => {
    if (tab === 'incoming') {
      return optimisticTransfers.filter((t) => t.status === 'REQUESTED' && (isAdmin || t.toWarehouse.id === userWarehouseId))
    } else if (tab === 'fulfill') {
      return optimisticTransfers.filter((t) => t.status === 'REQUESTED' && t.toWarehouse.id !== userWarehouseId)
    }
    return optimisticTransfers.filter((t) => t.status !== 'REQUESTED')
  }, [optimisticTransfers, tab, userWarehouseId, isAdmin])

  function validateRequest() {
    const payload = {
      productId: requestForm.productId,
      toWarehouseId: isAdmin ? warehouses[0]?.id : userWarehouseId || '',
      quantity: parseInt(requestForm.quantity),
      notes: requestForm.notes || undefined,
    }
    const result = transferRequestSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setRequestErrors(fieldErrors)
      return null
    }
    setRequestErrors({})
    return result.data
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    const validated = validateRequest()
    if (!validated) return

    const destinationId = isAdmin ? warehouses[0]?.id : userWarehouseId
    if (!destinationId) {
      showToast('No warehouse assigned', 'error')
      return
    }

    startTransition(async () => {
      const product = products.find((p) => p.id === validated.productId)
      addOptimistic({
        type: 'create',
        transfer: {
          id: `new-${Date.now()}`,
          quantityInitiated: validated.quantity,
          quantityReceived: 0,
          damagedQuantity: 0,
          status: 'REQUESTED',
          trackingNumber: null,
          notes: validated.notes || null,
          shippedAt: null,
          receivedAt: null,
          createdAt: new Date().toISOString(),
          product: product ? { id: product.id, name: product.name, sku: product.sku } : { id: '', name: '', sku: '' },
          fromWarehouse: null,
          toWarehouse: { id: destinationId, name: warehouses.find((w) => w.id === destinationId)?.name || '' },
          initiatedBy: { name: 'You' },
        },
      })
      setShowRequestModal(false)
      setRequestForm({ productId: '', quantity: '', notes: '' })

      try {
        const res = await fetch('/api/v1/transfers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: validated.productId, toWarehouseId: destinationId, quantity: validated.quantity, notes: validated.notes || undefined }),
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
      } catch (err: any) {
        showToast(err.message || 'Failed to create request', 'error')
      }
    })
  }

  async function handleAccept(transferId: string) {
    const sourceId = isAdmin ? acceptForm.fromWarehouseId : userWarehouseId
    if (!sourceId) {
      showToast('No warehouse assigned', 'error')
      return
    }

    startTransition(async () => {
      addOptimistic({
        type: 'accept',
        id: transferId,
        fromWarehouse: { id: sourceId, name: warehouses.find((w) => w.id === sourceId)?.name || '' },
      })
      setShowAcceptModal(null)
      setAcceptForm({ fromWarehouseId: '' })

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
        showToast('Transfer accepted &mdash; stock deducted')
      } catch (err: any) {
        showToast(err.message || 'Failed to accept', 'error')
      }
    })
  }

  async function handleShip(id: string) {
    const shipPayload = { trackingNumber: shipForm.trackingNumber || undefined }
    const result = transferShipSchema.safeParse(shipPayload)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setShipErrors(fieldErrors)
      return
    }
    setShipErrors({})

    startTransition(async () => {
      addOptimistic({ type: 'ship', id, trackingNumber: result.data.trackingNumber || null, shippedAt: new Date().toISOString() })
      setShowShipModal(null)
      setShipForm({ trackingNumber: '' })

      try {
        const res = await fetch(`/api/v1/transfers/${id}/ship`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.data),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        setTransfers((prev) => prev.map((t) =>
          t.id === id ? { ...t, status: 'IN_TRANSIT', shippedAt: data.transfer.shippedAt, trackingNumber: data.transfer.trackingNumber } : t
        ))
        showToast('Transfer shipped')
      } catch (err: any) {
        showToast(err.message || 'Failed to ship', 'error')
      }
    })
  }

  async function handleReceive(id: string) {
    const payload = {
      quantityReceived: parseInt(receiveForm.quantityReceived),
      damagedQuantity: parseInt(receiveForm.damagedQuantity) || 0,
      notes: receiveForm.notes || undefined,
    }
    const result = transferReceiveSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setReceiveErrors(fieldErrors)
      return
    }
    if ((result.data.damagedQuantity ?? 0) > result.data.quantityReceived) {
      setReceiveErrors({ damagedQuantity: 'Damaged quantity cannot exceed received quantity' })
      return
    }
    setReceiveErrors({})

    startTransition(async () => {
      addOptimistic({
        type: 'receive',
        id,
        quantityReceived: result.data.quantityReceived,
        damagedQuantity: result.data.damagedQuantity || 0,
        receivedAt: new Date().toISOString(),
      })
      setShowReceiveModal(null)
      setReceiveForm({ quantityReceived: '', damagedQuantity: '0', notes: '' })

      try {
        const res = await fetch(`/api/v1/transfers/${id}/receive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.data),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        setTransfers((prev) => prev.map((t) =>
          t.id === id ? { ...t, status: 'COMPLETED', quantityReceived: result.data.quantityReceived, damagedQuantity: result.data.damagedQuantity || 0, receivedAt: data.transfer.receivedAt } : t
        ))
        showToast('Transfer received')
      } catch (err: any) {
        showToast(err.message || 'Failed to receive', 'error')
      }
    })
  }

  async function handleLoadMore() {
    setLoadingMore(true)
    try {
      const params = new URLSearchParams(searchParams.toString())
      params.set('cursor', nextCursor!)
      params.set('take', '25')
      const res = await fetch(`/api/v1/transfers?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTransfers((prev) => [...prev, ...data.transfers])
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (err: any) {
      showToast(err.message || 'Failed to load more', 'error')
    } finally {
      setLoadingMore(false)
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
            {isAdmin ? `${cursorMode ? totalCount : total} total` : `${userWarehouseName} &middot; ${cursorMode ? totalCount : total} total`}
          </p>
        </div>
        <button onClick={() => { setShowRequestModal(true); setRequestErrors({}) }} className="btn btn-primary" style={{ gap: 8 }}>
          <Plus style={{ width: 16, height: 16 }} />
          New Request
        </button>
      </div>

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

      <div style={{ marginBottom: 16 }}>
        <SearchInput placeholder="Search transfers…" />
      </div>

      {tabbed.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={tab === 'incoming' ? (qParam ? 'No incoming requests match your search' : 'No incoming requests') : tab === 'fulfill' ? (qParam ? 'No requests to fulfill match your search' : 'No requests to fulfill') : (qParam ? 'No transfers match your search' : 'No active transfers')}
          description={qParam ? 'Try a different search term or clear the filter.' : 'Try a different search or create a new transfer request.'}
        />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: isPending ? 0.7 : 1 }}>
            {tabbed.map((t) => {
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
                        <button onClick={() => { setShowShipModal(t.id); setShipForm({ trackingNumber: '' }); setShipErrors({}) }} className="btn btn-primary" style={{ gap: 6, fontSize: 13 }}>
                          <Truck style={{ width: 14, height: 14 }} />
                          Ship
                        </button>
                      )}
                      {canReceive && (
                        <button onClick={() => { setShowReceiveModal(t.id); setReceiveForm({ quantityReceived: t.quantityInitiated.toString(), damagedQuantity: '0', notes: '' }); setReceiveErrors({}) }} className="btn btn-primary" style={{ gap: 6, fontSize: 13 }}>
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
          {cursorMode ? (
            <CursorPagination totalCount={totalCount!} hasMore={hasMore} loading={loadingMore} onLoadMore={handleLoadMore} />
          ) : (
            <PaginationBar total={total!} page={page!} pageSize={pageSize!} />
          )}
        </>
      )}

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
                />
                {requestErrors.productId && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{requestErrors.productId}</p>}
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
                <input className="input tabular" type="number" min="1" value={requestForm.quantity} onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })} />
                {requestErrors.quantity && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{requestErrors.quantity}</p>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</label>
                <input className="input" value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} placeholder="Optional..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowRequestModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept & Deduct Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                {shipErrors.trackingNumber && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{shipErrors.trackingNumber}</p>}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowShipModal(null)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <input className="input tabular" type="number" min="0" value={receiveForm.quantityReceived} onChange={(e) => setReceiveForm({ ...receiveForm, quantityReceived: e.target.value })} />
                {receiveErrors.quantityReceived && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{receiveErrors.quantityReceived}</p>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Damaged Quantity</label>
                <input className="input tabular" type="number" min="0" value={receiveForm.damagedQuantity} onChange={(e) => setReceiveForm({ ...receiveForm, damagedQuantity: e.target.value })} />
                {receiveErrors.damagedQuantity && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{receiveErrors.damagedQuantity}</p>}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Damaged items will be written off from inventory.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</label>
                <input className="input" value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} placeholder="Optional..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowReceiveModal(null)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Receive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
