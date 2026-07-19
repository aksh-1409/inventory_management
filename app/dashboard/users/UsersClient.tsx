'use client'

import { useState, useMemo } from 'react'
import { Users, Search, X, Shield, User } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface UserData {
  id: string
  name: string
  email: string
  role: string
  warehouse: { id: string; name: string } | null
  createdAt: string
}

interface Props {
  initialUsers: UserData[]
  currentUserId: string
}

export default function UsersClient({ initialUsers, currentUserId }: Props) {
  const [users] = useState<UserData[]>(initialUsers)
  const [search, setSearch] = useState('')

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
