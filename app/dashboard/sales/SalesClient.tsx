'use client'

import { useState, useEffect, useRef, useOptimistic, useTransition } from 'react'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { useSearchParams } from 'next/navigation'
import { ShoppingCart, Plus, X, Loader2, UserPlus, Phone, Check } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SearchInput } from '@/components/ui/SearchInput'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { useToast } from '@/components/ui/Toast'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { SalesInvoiceDownload } from '@/components/pdf/SalesInvoicePDF'
import { saleSchema } from '@/lib/schemas'

interface Sale {
  id: string
  delta: number
  reference: string | null
  createdAt: string
  product: { id: string; name: string; sku: string }
  warehouse: { id: string; name: string }
  customerId?: string
  unitPrice?: number
}

interface Product { id: string; name: string; sku: string; price: number }
interface Warehouse { id: string; name: string }
interface Customer { id: string; name: string; phone?: string }

interface Props {
  initialSales: Sale[]
  total: number
  page: number
  pageSize: number
  products: Product[]
  warehouses: Warehouse[]
  customers: Customer[]
  userRole: string
  allCustomers: Customer[]
}

type OptimisticAction = { type: 'create'; sale: Sale }

export default function SalesClient({ initialSales, total, page, pageSize, products, warehouses, customers, userRole, allCustomers }: Props) {
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const qParam = searchParams.get('q') || ''
  const [isPending, startTransition] = useTransition()
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [optimisticSales, addOptimistic] = useOptimistic(sales, (state, action: OptimisticAction) => {
    if (action.type === 'create') return [action.sale, ...state]
    return state
  })
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>(customers)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ productId: '', warehouseId: '', customerId: '', quantity: '', unitPrice: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [phoneInput, setPhoneInput] = useState('')
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false)
  const [creatingInline, setCreatingInline] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const phoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setSales(initialSales); setLoading(false) }, [initialSales])

  const phoneMatches = existingCustomers.filter((c) => c.phone && phoneInput && c.phone.toLowerCase().includes(phoneInput.toLowerCase()))

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (phoneRef.current && !phoneRef.current.contains(e.target as Node)) {
        setShowPhoneDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openCreate() {
    setForm({ productId: '', warehouseId: '', customerId: '', quantity: '', unitPrice: '', notes: '' })
    setErrors({})
    setPhoneInput('')
    setMatchedCustomer(null)
    setCreatingInline(false)
    setNewCustomerName('')
    setNewCustomerEmail('')
    setShowPhoneDropdown(false)
    setShowModal(true)
  }

  function selectCustomer(c: Customer) {
    setMatchedCustomer(c)
    setForm({ ...form, customerId: c.id })
    setPhoneInput(c.phone || '')
    setCreatingInline(false)
    setShowPhoneDropdown(false)
  }

  function handlePhoneChange(value: string) {
    setPhoneInput(value)
    setShowPhoneDropdown(true)
    const exact = existingCustomers.find((c) => c.phone && c.phone === value)
    if (exact) {
      setMatchedCustomer(exact)
      setForm({ ...form, customerId: exact.id })
      setCreatingInline(false)
    } else {
      setMatchedCustomer(null)
      setForm({ ...form, customerId: '' })
      if (value.length >= 3) setCreatingInline(true)
    }
  }

  async function createCustomerIfNeeded(): Promise<string | null> {
    if (matchedCustomer) return matchedCustomer.id
    if (!creatingInline) return form.customerId || null
    if (!newCustomerName.trim() || !phoneInput.trim()) {
      showToast('Customer name and phone are required', 'error')
      return null
    }

    const res = await fetch('/api/v1/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCustomerName.trim(), phone: phoneInput.trim(), email: newCustomerEmail.trim() || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error || 'Failed to create customer', 'error'); return null }

    const created: Customer = { id: data.customer.id, name: data.customer.name, phone: data.customer.phone }
    setExistingCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    setMatchedCustomer(created)
    return created.id
  }

  function validateSale() {
    const qty = parseInt(form.quantity)
    const up = parseFloat(form.unitPrice) || products.find((p) => p.id === form.productId)?.price || 0
    const payload = {
      productId: form.productId,
      warehouseId: form.warehouseId,
      customerId: form.customerId,
      quantity: form.quantity,
      unitPrice: form.unitPrice || String(up),
      notes: form.notes || undefined,
    }
    const result = saleSchema.safeParse(payload)
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
    const validated = validateSale()
    if (!validated) return

    const qty = validated.quantity
    const up = validated.unitPrice

    startTransition(async () => {
      const customerId = await createCustomerIfNeeded()
      if (!customerId) { showToast('Please enter a customer phone number', 'error'); return }

      const optimisticSale: Sale = {
        id: `new-${Date.now()}`,
        delta: -qty,
        reference: form.notes || 'Sale to customer',
        createdAt: new Date().toISOString(),
        product: products.find((p) => p.id === form.productId) || { id: '', name: '', sku: '' },
        warehouse: warehouses.find((w) => w.id === form.warehouseId) || { id: '', name: '' },
        customerId,
        unitPrice: up,
      }
      addOptimistic({ type: 'create', sale: optimisticSale })
      setShowModal(false)

      try {
        const res = await fetch('/api/v1/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: form.productId, warehouseId: form.warehouseId, customerId, quantity: qty, unitPrice: up, notes: form.notes || undefined }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        const product = products.find((p) => p.id === form.productId)!
        const warehouse = warehouses.find((w) => w.id === form.warehouseId)!
        setSales((prev) => [{
          id: data.sale.id, delta: -qty, reference: form.notes || 'Sale to customer', createdAt: data.sale.createdAt,
          product: { id: product.id, name: product.name, sku: product.sku },
          warehouse: { id: warehouse.id, name: warehouse.name }, customerId, unitPrice: up,
        }, ...prev])
        showToast(`Sale recorded: ${qty} units`)
      } catch (err: any) { showToast(err.message || 'Failed to record sale', 'error') }
    })
  }

  const selectedProduct = products.find((p) => p.id === form.productId)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Sales</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{total} recorded sales</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary" style={{ gap: 8 }}>
          <Plus style={{ width: 16, height: 16 }} />
          Record Sale
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchInput placeholder="Search sales…" />
      </div>

      {loading ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      ) : error && optimisticSales.length === 0 ? (
        <ErrorState message={error} onRetry={() => { setError(null); setSales(initialSales) }} />
      ) : optimisticSales.length === 0 ? (
        <EmptyState icon={ShoppingCart} title={qParam ? 'No sales match your search' : 'No sales yet'} description={qParam ? 'Try a different search term or clear the filter.' : 'Record your first sale to get started.'} />
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden', opacity: isPending ? 0.7 : 1 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Product', 'SKU', 'Warehouse', 'Qty', 'Date', 'Reference', 'Invoice'].map((h) => (
                      <th key={h} style={{ padding: '16px 24px', textAlign: h === 'Qty' ? 'center' : 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {optimisticSales.map((sale) => (
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
                      <td data-label="Invoice" style={{ padding: '16px 24px' }}>
                        {(() => {
                          const customer = allCustomers.find((c) => c.id === sale.customerId)
                          const qty = Math.abs(sale.delta)
                          const up = sale.unitPrice ?? products.find((p) => p.id === sale.product.id)?.price ?? 0
                          return (
                            <SalesInvoiceDownload sale={{
                              id: sale.id, quantity: qty, unitPrice: up, total: qty * up, createdAt: sale.createdAt,
                              product: sale.product, warehouse: sale.warehouse,
                              customer: customer ? { name: customer.name } : { name: 'Customer' },
                            }} />
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <PaginationBar total={total} page={page} pageSize={pageSize} />
        </>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 520, borderRadius: 12, border: '1px solid var(--border)', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>Record Sale</h2>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }} aria-label="Close">
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Product *</label>
                <CustomSelect
                  options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
                  value={form.productId}
                  onChange={(v) => { const p = products.find((x) => x.id === v); setForm({ ...form, productId: v, unitPrice: p ? String(p.price) : form.unitPrice }) }}
                  placeholder="Select product..."
                />
                {errors.productId && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.productId}</p>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Warehouse *</label>
                <CustomSelect
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                  value={form.warehouseId}
                  onChange={(v) => setForm({ ...form, warehouseId: v })}
                  placeholder="Select warehouse..."
                />
                {errors.warehouseId && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.warehouseId}</p>}
              </div>
              <div ref={phoneRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Customer Phone *</label>
                <div style={{ position: 'relative' }}>
                  <Phone style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: matchedCustomer ? 'var(--success)' : 'var(--text-muted)' }} />
                  <input className="input" style={{ paddingLeft: 34, paddingRight: matchedCustomer ? 34 : 12 }} value={phoneInput} onChange={(e) => handlePhoneChange(e.target.value)} onFocus={() => { if (phoneInput.length >= 2) setShowPhoneDropdown(true) }} placeholder="Type phone to search customer..." />
                  {matchedCustomer && (
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check style={{ width: 14, height: 14, color: 'var(--success)' }} />
                      <button type="button" onClick={() => { setMatchedCustomer(null); setForm({ ...form, customerId: '' }); setPhoneInput(''); setCreatingInline(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }} aria-label="Clear customer">
                        <X style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  )}
                </div>
                {errors.customerId && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.customerId}</p>}
                {matchedCustomer && (
                  <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <p style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>Existing customer found</p>
                    <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 600, marginTop: 2 }}>{matchedCustomer.name}</p>
                  </div>
                )}
                {showPhoneDropdown && !matchedCustomer && phoneMatches.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, maxHeight: 160, overflowY: 'auto', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                    {phoneMatches.map((c) => (
                      <button key={c.id} type="button" onClick={() => selectCustomer(c)} style={{ width: '100%', padding: '9px 12px', fontSize: 13, color: 'var(--text-heading)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <span>{c.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {creatingInline && !matchedCustomer && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <UserPlus style={{ width: 14, height: 14, color: 'var(--accent)' }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>New Customer &mdash; will be saved with this sale</span>
                    </div>
                    <input className="input" style={{ marginBottom: 8 }} value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Customer name *" />
                    <input className="input" type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} placeholder="Email (optional)" />
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Quantity *</label>
                  <input className="input tabular" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                  {errors.quantity && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.quantity}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Unit Price *</label>
                  <input className="input tabular" type="number" step="0.01" min="0" value={form.unitPrice || (selectedProduct?.price || '')} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
                  {errors.unitPrice && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{errors.unitPrice}</p>}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</label>
                <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={isPending} className="btn btn-primary">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
