'use client'

import { useState, useEffect } from 'react'
import { getSession, useSession } from 'next-auth/react'
import { Package, Loader2, AlertCircle } from 'lucide-react'

interface Warehouse { id: string; name: string }

export default function SetupPage() {
  const { update: updateSession } = useSession()
  const [name, setName] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    fetch('/api/v1/warehouses').then(r => r.json()).then(d => setWarehouses(d.warehouses || [])).catch(() => {})
    getSession().then(session => {
      if (session?.user?.name) setName(session.user.name)
      if ((session as any)?.user?.role) setUserRole((session as any).user.role)
      setNeedsPassword(!(session as any)?.user?.passwordSetAt)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (needsPassword && password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    const res = await fetch('/api/auth/setup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, warehouseId, password: needsPassword ? password : undefined }),
    })

    if (!res.ok) {
      let message = 'Something went wrong'
      try {
        const data = await res.json()
        message = data.error || message
      } catch {}
      setError(message)
      setLoading(false)
      return
    }

    await updateSession({ trigger: 'update' })
    window.location.href = '/dashboard'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 16px',
    color: 'white',
    fontSize: 14,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'rgba(161,161,170,0.8)',
    marginBottom: 6,
    display: 'block',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '32px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <Package style={{ width: 24, height: 24, color: 'rgba(167,139,250,1)' }} />
          <span style={{ fontWeight: 600, fontSize: 18, color: 'white' }}>Complete your profile</span>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Display name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              required
              minLength={2}
              style={inputStyle}
            />
          </div>

          {needsPassword && (
            <>
              <div>
                <label style={labelStyle}>Create a StockPilot password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" style={inputStyle} />
                <p style={{ fontSize: 11, color: 'rgba(161,161,170,0.5)', marginTop: 4 }}>Use this password when signing in without Google or GitHub.</p>
              </div>
              <div>
                <label style={labelStyle}>Confirm password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} placeholder="Repeat your password" style={inputStyle} />
              </div>
            </>
          )}

          <div>
            <label style={labelStyle}>
              Warehouse
              {userRole === 'ADMIN' && <span style={{ color: 'rgba(161,161,170,0.5)', fontWeight: 400 }}> (optional for admins)</span>}
            </label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              required={userRole !== 'ADMIN'}
              style={{ ...inputStyle, appearance: 'auto' }}
            >
              <option value="" style={{ background: '#1a1a1a' }}>
                {userRole === 'ADMIN' ? 'All warehouses (no restriction)' : 'Select a warehouse'}
              </option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id} style={{ background: '#1a1a1a' }}>{w.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              border: 'none',
              color: 'white',
              fontWeight: 500,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            {loading ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Saving...</> : 'Continue to dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
