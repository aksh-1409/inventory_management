'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Command, LayoutGrid, Package, Warehouse, ArrowLeftRight, Truck, ShoppingCart, Boxes, Receipt, Users, Key, Settings, Shield, Plus, X } from 'lucide-react'
import { useHotkey } from '@/lib/useHotkey'

interface Action {
  id: string
  label: string
  icon: React.ComponentType<{ style?: React.CSSProperties }>
  href?: string
  action?: () => void
  keywords: string[]
  adminOnly?: boolean
}

const DEFAULT_ACTIONS: Action[] = [
  { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutGrid, href: '/dashboard', keywords: ['home', 'dashboard'] },
  { id: 'nav-products', label: 'Go to Products', icon: Package, href: '/dashboard/products', keywords: ['products', 'items', 'sku'] },
  { id: 'nav-warehouses', label: 'Go to Warehouses', icon: Warehouse, href: '/dashboard/warehouses', keywords: ['warehouses', 'locations'] },
  { id: 'nav-transfers', label: 'Go to Transfers', icon: ArrowLeftRight, href: '/dashboard/transfers', keywords: ['transfers', 'ship', 'move'] },
  { id: 'nav-suppliers', label: 'Go to Suppliers', icon: Truck, href: '/dashboard/suppliers', keywords: ['suppliers', 'vendors'] },
  { id: 'nav-customers', label: 'Go to Customers', icon: ShoppingCart, href: '/dashboard/customers', keywords: ['customers', 'clients'] },
  { id: 'nav-inventory', label: 'Go to Inventory', icon: Boxes, href: '/dashboard/inventory', keywords: ['inventory', 'stock'] },
  { id: 'nav-sales', label: 'Go to Sales', icon: Receipt, href: '/dashboard/sales', keywords: ['sales', 'orders'] },
  { id: 'nav-receiving', label: 'Go to Receiving', icon: Plus, href: '/dashboard/receiving', keywords: ['receiving', 'receive', 'inbound'] },
  { id: 'nav-users', label: 'Go to Users', icon: Users, href: '/dashboard/users', keywords: ['users', 'admins', 'operators'], adminOnly: true },
  { id: 'nav-api-keys', label: 'Go to API Keys', icon: Key, href: '/dashboard/api-keys', keywords: ['api', 'keys', 'tokens'], adminOnly: true },
  { id: 'nav-audit-log', label: 'Go to Audit Log', icon: Shield, href: '/dashboard/audit-log', keywords: ['audit', 'log', 'activity'], adminOnly: true },
  { id: 'nav-settings', label: 'Go to Settings', icon: Settings, href: '/dashboard/settings', keywords: ['settings', 'webhooks', 'config'], adminOnly: true },
]

interface CommandPaletteProps {
  isAdmin?: boolean
}

export function CommandPalette({ isAdmin = false }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useHotkey('mod+k', () => { setOpen(o => !o); setQuery('') })
  useHotkey('escape', () => { setOpen(false); setQuery('') }, { enabled: open })

  const filtered = DEFAULT_ACTIONS
    .filter(a => !a.adminOnly || isAdmin)
    .filter(a => {
      if (!query) return true
      const q = query.toLowerCase()
      return a.label.toLowerCase().includes(q) || a.keywords.some(k => k.includes(q))
    })

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[selectedIndex]) {
      const action = filtered[selectedIndex]
      if (action.href) router.push(action.href)
      if (action.action) action.action()
      setOpen(false)
    }
  }, [filtered, selectedIndex, router])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const el = listRef.current.children[selectedIndex] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', justifyContent: 'center', paddingTop: '15vh',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
      />
      <div
        className="surface-3"
        style={{
          position: 'relative', width: '100%', maxWidth: 560,
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and actions..."
            style={{
              flex: 1, background: 'none', border: 'none', color: 'var(--text-heading)',
              fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}
            aria-label="Search commands"
          />
          <kbd style={{
            padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: 4,
            fontSize: 11, color: 'var(--text-muted)', fontFamily: 'inherit',
          }}>
            ESC
          </kbd>
        </div>
        <div ref={listRef} style={{ maxHeight: 320, overflowY: 'auto', padding: 4 }} role="listbox">
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              No results found
            </div>
          ) : (
            filtered.map((action, i) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  role="option"
                  aria-selected={i === selectedIndex}
                  onClick={() => {
                    if (action.href) router.push(action.href)
                    if (action.action) action.action()
                    setOpen(false)
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '8px 12px', borderRadius: 6, border: 'none',
                    background: i === selectedIndex ? 'rgba(59,158,255,0.12)' : 'transparent',
                    color: 'var(--text-heading)', fontSize: 14, cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left', transition: 'background 100ms ease',
                  }}
                >
                  <Icon style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>{action.label}</span>
                </button>
              )
            })
          )}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
          <span><kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: 3, fontFamily: 'inherit' }}>↑↓</kbd> Navigate</span>
          <span><kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: 3, fontFamily: 'inherit' }}>↵</kbd> Open</span>
          <span><kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: 3, fontFamily: 'inherit' }}>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
