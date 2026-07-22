'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Package,
  Warehouse,
  LayoutGrid,
  ArrowLeftRight,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Key,
  ShoppingCart,
  Truck,
  PlusCircle,
  Boxes,
  Receipt,
  UserCircle,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
  { label: 'Products', href: '/dashboard/products', icon: Package },
  { label: 'Warehouses', href: '/dashboard/warehouses', icon: Warehouse },
  { label: 'Transfers', href: '/dashboard/transfers', icon: ArrowLeftRight },
  { label: 'Suppliers', href: '/dashboard/suppliers', icon: Truck },
  { label: 'Customers', href: '/dashboard/customers', icon: ShoppingCart },
  { label: 'Inventory', href: '/dashboard/inventory', icon: Boxes },
  { label: 'Sales', href: '/dashboard/sales', icon: Receipt },
  { label: 'Receiving', href: '/dashboard/receiving', icon: Truck },
  { label: 'Users', href: '/dashboard/users', icon: Users, adminOnly: true },
  { label: 'API Keys', href: '/dashboard/api-keys', icon: Key, adminOnly: true },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, adminOnly: true },
]

export default function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const isAdmin = session?.user?.role === 'ADMIN'
  const filteredItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  function NavLink({ item }: { item: NavItem }) {
    const isActive =
      pathname === item.href ||
      (item.href !== '/dashboard' && pathname.startsWith(item.href))
    const Icon = item.icon

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          minHeight: 40,
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          textDecoration: 'none',
          transition: 'background 150ms ease, color 150ms ease',
          background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: isActive ? '#FCFDFF' : 'rgba(252,253,255,0.70)',
        }}
        onMouseEnter={e => {
          if (!isActive) {
            (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)'
            ;(e.currentTarget as HTMLAnchorElement).style.color = '#FCFDFF'
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLAnchorElement).style.color = 'rgba(252,253,255,0.70)'
          }
        }}
      >
        <Icon
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            color: isActive ? '#FCFDFF' : 'rgba(252,253,255,0.50)',
          }}
        />
        <span>{item.label}</span>
      </Link>
    )
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 24px',
        height: 64,
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 32, height: 32,
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Package style={{ width: 14, height: 14, color: 'white' }} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'white', letterSpacing: '-0.01em' }}>
          StockPilot
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filteredItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* User Footer */}
      <div style={{
        padding: '12px 12px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Link
          href="/dashboard/profile"
          style={{
            width: 32, height: 32,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: 'white',
            flexShrink: 0,
            textDecoration: 'none',
          }}
        >
          {session?.user?.name?.charAt(0)?.toUpperCase() || '?'}
        </Link>
        <Link
          href="/dashboard/profile"
          style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
        >
          <p style={{ fontSize: 14, color: '#FCFDFF', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session?.user?.name}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(252,253,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {session?.user?.warehouseName
              ? `${session.user.warehouseName} · ${session.user.role}`
              : session?.user?.role}
          </p>
        </Link>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          title="Sign out"
          style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(252,253,255,0.50)',
            borderRadius: 8,
            flexShrink: 0,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(252,253,255,0.50)' }}
        >
          <LogOut style={{ width: 16, height: 16 }} />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Hamburger: CSS hides on lg+ */}
      <button
        className="hamburger-btn"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu style={{ width: 16, height: 16 }} />
      </button>

      {/* Mobile: overlay + slide-in sidebar */}
      <div className="sidebar-mobile-wrap">
        {/* Backdrop */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.65)',
            }}
          />
        )}

        {/* Mobile Sidebar */}
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, bottom: 0,
            width: 260,
            zIndex: 50,
            background: 'var(--bg-surface-1)',
            borderRight: '1px solid var(--border)',
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 220ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            style={{
              position: 'absolute', top: 14, right: 14, zIndex: 10,
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer',
              color: 'rgba(252,253,255,0.60)', borderRadius: 8,
              transition: 'color 150ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'white' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(252,253,255,0.60)' }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
          <SidebarContent />
        </div>
      </div>

      {/* Desktop Sidebar: CSS shows on lg+ */}
      <aside className="sidebar-desktop">
        <SidebarContent />
      </aside>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <>
          <div
            onClick={() => setShowLogoutConfirm(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.5)',
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 101, background: '#1a1a1a', borderRadius: 12, padding: 24,
            border: '1px solid rgba(255,255,255,0.1)', minWidth: 280, maxWidth: 360,
          }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'white', marginBottom: 8 }}>
              Sign out
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(161,161,170,0.8)', marginBottom: 20 }}>
              Are you sure you want to sign out?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(212,212,216,1)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/login' })}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: 'var(--danger)', border: 'none',
                  color: 'white', cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
