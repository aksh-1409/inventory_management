'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Clock3, Loader2, Package, XCircle } from 'lucide-react'

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'

export default function PasswordResetPage() {
  const [status, setStatus] = useState<Status>('PENDING')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function poll() {
      try {
        const response = await fetch('/api/auth/password-reset-request/status', { cache: 'no-store' })
        const data = await response.json()
        if (active) setStatus(data.status)
      } catch {
        if (active) setError('Unable to check approval status. Retrying...')
      }
    }
    poll()
    const timer = setInterval(poll, 3000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  async function completeReset(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    setError(null)
    const response = await fetch('/api/auth/password-reset-request/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await response.json()
    setLoading(false)
    if (!response.ok) return setError(data.error || 'Unable to reset password.')
    setStatus('COMPLETED')
    setTimeout(() => { window.location.href = '/auth/login?reset=true' }, 1200)
  }

  const terminal = status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED'

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', display: 'grid', placeItems: 'center', padding: 16 }}>
      <section className="card" style={{ width: '100%', maxWidth: 440, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <Package style={{ width: 22, color: 'var(--accent)' }} />
          <strong style={{ color: 'var(--text-heading)', fontSize: 18 }}>Password reset</strong>
        </div>

        {status === 'PENDING' && <StatusMessage icon={Clock3} title="Waiting for administrator" text="Keep this page open. It will update automatically when an administrator reviews your request." />}
        {status === 'REJECTED' && <StatusMessage icon={XCircle} title="Request rejected" text="An administrator rejected your password reset request." danger />}
        {(status === 'EXPIRED' || status === 'CANCELLED') && <StatusMessage icon={XCircle} title="Request no longer available" text="Submit a new password reset request to continue." danger />}
        {status === 'COMPLETED' && <StatusMessage icon={CheckCircle} title="Password updated" text="Redirecting you to sign in with your new password." />}

        {status === 'APPROVED' && (
          <form onSubmit={completeReset}>
            <StatusMessage icon={CheckCircle} title="Request approved" text="Create your new StockPilot password." />
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>New password</label>
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} required className="input" autoComplete="new-password" />
            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, margin: '14px 0 6px' }}>Confirm password</label>
            <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} required className="input" autoComplete="new-password" />
            <button className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}>
              {loading && <Loader2 style={{ width: 15, animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Updating...' : 'Set new password'}
            </button>
          </form>
        )}

        {error && status !== 'APPROVED' && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 14 }}>{error}</p>}
        {terminal && <Link href="/auth/forgot-password" style={{ display: 'inline-block', marginTop: 18, color: 'var(--accent)', fontSize: 13 }}>Submit another request</Link>}
      </section>
    </main>
  )
}

function StatusMessage({ icon: Icon, title, text, danger = false }: { icon: React.ElementType; title: string; text: string; danger?: boolean }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Icon style={{ width: 28, color: danger ? 'var(--danger)' : 'var(--accent)', marginBottom: 10 }} />
      <h1 style={{ color: 'var(--text-heading)', fontSize: 22, marginBottom: 6 }}>{title}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}
