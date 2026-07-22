'use client'

import { useEffect, useState, useMemo } from 'react'
import { Users, Search, X, Shield, User, Check, Loader2, XCircle, Clock3 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface UserData {
  id: string
  name: string
  email: string
  role: string
  warehouse: { id: string; name: string } | null
  createdAt: string
}

interface ResetRequestData {
  id: string
  operatorName: string
  operatorEmail: string
  warehouseName: string | null
  requestedAt: string
  expiresAt: string
}

interface Props {
  initialUsers: UserData[]
  currentUserId: string
}

export default function UsersClient({ initialUsers, currentUserId }: Props) {
  const [users] = useState<UserData[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [requests, setRequests] = useState<ResetRequestData[]>([])
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadRequests() {
    const response = await fetch('/api/auth/admin-reset-requests', { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json()
    setRequests(data.requests)
  }

  useEffect(() => {
    loadRequests()
    const timer = setInterval(loadRequests, 5000)
    return () => clearInterval(timer)
  }, [])

  async function reviewRequest(id: string, action: 'approve' | 'reject') {
    setReviewing(id)
    setError(null)
    const response = await fetch(`/api/auth/admin-reset-requests/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await response.json()
    setReviewing(null)
    if (!response.ok) return setError(data.error || 'Unable to review request.')
    setRequests(current => current.filter(request => request.id !== id))
  }

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) || u.warehouse?.name.toLowerCase().includes(q)
    )
  }, [users, search])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>Users</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{users.length} registered users</p>
        </div>
      </div>

      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
        <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="input" style={{ paddingLeft: 36 }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: requests.length ? 16 : 0 }}>
          <div>
            <h2 style={{ color: 'var(--text-heading)', fontSize: 16, fontWeight: 600 }}>Password reset approvals</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>{requests.length} pending request{requests.length === 1 ? '' : 's'}</p>
          </div>
          <Clock3 style={{ width: 18, color: requests.length ? 'var(--accent)' : 'var(--text-muted)' }} />
        </div>
        {requests.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No operators are waiting for a password reset.</p>
        ) : requests.map(request => (
          <div key={request.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: 'var(--text-heading)', fontSize: 14, fontWeight: 500 }}>{request.operatorName}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{request.operatorEmail} · {request.warehouseName || 'No warehouse'}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3 }}>Requested {new Date(request.requestedAt).toLocaleString()}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={reviewing === request.id} onClick={() => reviewRequest(request.id, 'reject')} className="btn" style={{ color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <XCircle style={{ width: 14 }} /> Reject
              </button>
              <button disabled={reviewing === request.id} onClick={() => reviewRequest(request.id, 'approve')} className="btn btn-primary">
                {reviewing === request.id ? <Loader2 style={{ width: 14, animation: 'spin 1s linear infinite' }} /> : <Check style={{ width: 14 }} />}
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description={search ? 'Try a different search.' : 'No users registered yet.'} />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</th>
                  <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Warehouse</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td data-label="User" style={{ padding: '16px 24px' }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-heading)' }}>
                          {u.name}
                          {u.id === currentUserId && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 6 }}>(you)</span>}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</p>
                      </div>
                    </td>
                    <td data-label="Role" style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <span className="badge" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: u.role === 'ADMIN' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)',
                        color: u.role === 'ADMIN' ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: 12,
                      }}>
                        {u.role === 'ADMIN' ? <Shield style={{ width: 12, height: 12 }} /> : <User style={{ width: 12, height: 12 }} />}
                        {u.role}
                      </span>
                    </td>
                    <td data-label="Warehouse" style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 13, color: u.warehouse ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {u.warehouse?.name || '—'}
                      </span>
                    </td>
                    <td data-label="Joined" style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
