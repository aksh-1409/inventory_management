'use client'

import { useState } from 'react'
import { Package, Warehouse as WarehouseIcon, ArrowLeftRight, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'

interface Props {
  stats: { totalProducts: number; totalWarehouses: number; lowStockCount: number; pendingCount: number }
  products: { id: string; name: string; sku: string; reorderPoint: number }[]
  warehouses: { id: string; name: string }[]
  matrix: Record<string, Record<string, { quantity: number; reorderPoint: number }>>
  pendingTransfers: {
    id: string; quantityInitiated: number; status: string; createdAt: string
    product: { name: string; sku: string }
    fromWarehouse: { name: string } | null
    toWarehouse: { name: string }
  }[]
  recentTransactions: {
    id: string; type: string; delta: number; reference: string | null; createdAt: string
    product: { name: string }
    warehouse: { name: string }
  }[]
  userName: string
  userRole: string
  userWarehouseId?: string | null
}

function getStockColor(qty: number, reorderPoint: number) {
  if (qty === 0) return { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.02)' }
  if (qty <= reorderPoint) return { color: 'var(--danger)', bg: 'rgba(255,32,71,0.08)' }
  if (qty < reorderPoint * 2) return { color: 'var(--warning)', bg: 'rgba(251,191,36,0.08)' }
  return { color: 'var(--success)', bg: 'rgba(52,211,153,0.08)' }
}

const TX_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  IN: { icon: TrendingUp, color: 'var(--success)' },
  OUT: { icon: TrendingDown, color: 'var(--danger)' },
  TRANSFER_IN: { icon: TrendingUp, color: 'var(--accent)' },
  TRANSFER_OUT: { icon: TrendingDown, color: 'var(--accent)' },
  ADJUSTMENT: { icon: AlertTriangle, color: 'var(--warning)' },
}

export default function DashboardClient({ stats, products, warehouses, matrix, pendingTransfers, recentTransactions, userName, userRole, userWarehouseId }: Props) {
  const matrixWarehouses = userWarehouseId ? warehouses.filter(w => w.id === userWarehouseId) : warehouses

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, opacity: 0.12, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(ellipse at top, var(--accent) 0%, transparent 65%)' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 32, paddingTop: 8 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Welcome back, <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{userName}</span>
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, padding: '4px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{userRole}</span>
          </p>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 400, color: 'var(--text-heading)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>Inventory overview</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { icon: Package, label: 'Products', value: stats.totalProducts, accent: 'var(--text-heading)', iconBg: 'rgba(255,255,255,0.06)' },
            { icon: WarehouseIcon, label: 'Warehouses', value: stats.totalWarehouses, accent: 'var(--text-heading)', iconBg: 'rgba(255,255,255,0.06)' },
            { icon: ArrowLeftRight, label: 'Active Transfers', value: stats.pendingCount, accent: 'var(--warning)', iconBg: 'rgba(251,191,36,0.15)' },
            { icon: AlertTriangle, label: 'Low Stock Alerts', value: stats.lowStockCount, accent: 'var(--danger)', iconBg: 'rgba(255,32,71,0.15)' },
          ].map(({ icon: Icon, label, value, accent, iconBg }) => (
            <div key={label} className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 20, height: 20, color: accent }} />
              </div>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <p className="tabular" style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-heading)', lineHeight: 1 }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Inventory Matrix */}
        <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-heading)' }}>Stock Matrix</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Products x Warehouses</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', left: 0, background: 'var(--bg-surface-1)', zIndex: 1 }}>Product</th>
                  {matrixWarehouses.map((w) => (
                    <th key={w.id} style={{ padding: '12px 24px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 100 }}>{w.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 24px', position: 'sticky', left: 0, background: 'var(--bg-surface-1)', zIndex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-heading)' }}>{p.name}</p>
                      <p className="tabular" style={{ fontSize: 12, color: 'var(--accent)' }}>{p.sku}</p>
                    </td>
                    {matrixWarehouses.map((w) => {
                      const cell = matrix[p.id]?.[w.id]
                      const qty = cell?.quantity || 0
                      const rp = cell?.reorderPoint || p.reorderPoint
                      const { color, bg } = getStockColor(qty, rp)
                      return (
                        <td key={w.id} style={{ padding: '12px 24px', textAlign: 'center', background: bg }}>
                          <span className="tabular" style={{ fontSize: 16, fontWeight: 600, color }}>{qty}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Pending Transfers */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 16 }}>Active Transfers</h3>
            {pendingTransfers.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No active transfers</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingTransfers.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-heading)' }}>{t.product.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(t.fromWarehouse?.name ?? '?')} → {t.toWarehouse.name}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{ background: t.status === 'PENDING' ? 'rgba(251,191,36,0.12)' : 'rgba(99,102,241,0.12)', color: t.status === 'PENDING' ? 'var(--warning)' : 'var(--accent)', fontSize: 12 }}>{t.status}</span>
                      <p className="tabular" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>x{t.quantityInitiated}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 16 }}>Recent Activity</h3>
            {recentTransactions.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No recent activity</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recentTransactions.slice(0, 8).map((t) => {
                  const cfg = TX_ICONS[t.type] || TX_ICONS.ADJUSTMENT
                  const Icon = cfg.icon
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: 14, height: 14, color: cfg.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.product.name} @ {t.warehouse.name}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.type.replace('_', ' ')}</p>
                      </div>
                      <span className="tabular" style={{ fontSize: 14, fontWeight: 600, color: t.delta > 0 ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
                        {t.delta > 0 ? '+' : ''}{t.delta}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
