'use client'

import { useState, useMemo } from 'react'
import { Key, Plus, Search, X, Loader2, Trash2, Eye, EyeOff, Copy } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/Toast'

interface ApiKey {
  id: string
  name: string
  keyPreview: string
  scopes: string[]
  isActive: boolean
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface Props {
  initialKeys: ApiKey[]
  total?: number
  page?: number
  pageSize?: number
}

export default function ApiKeysClient({ initialKeys }: Props) {
  const { showToast } = useToast()
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState({
    name: '',
    scopes: [] as string[],
    expiresInDays: '90',
  })

  const availableScopes = ['products:read', 'products:write', 'inventory:read', 'inventory:write', 'transfers:read', 'transfers:write', 'sales:read', 'sales:write', 'warehouses:read']

  const filtered = useMemo(() => {
    if (!search) return keys
    const q = search.toLowerCase()
    return keys.filter((k) => k.name.toLowerCase().includes(q) || k.scopes.some((s) => s.includes(q)))
  }, [keys, search])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name.trim()) {
      showToast('Please enter a name', 'error')
      return
    }
    if (createForm.scopes.length === 0) {
      showToast('Select at least one scope', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          scopes: createForm.scopes,
          expiresInDays: createForm.expiresInDays ? parseInt(createForm.expiresInDays) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setNewKeyVisible(data.key)
      setKeys((prev) => [{ ...data.apiKey, keyPreview: data.keyPreview }, ...prev])
      showToast('API key created')
      setShowCreateModal(false)
      setCreateForm({ name: '', scopes: [], expiresInDays: '90' })
    } catch (err: any) {
      showToast(err.message || 'Failed to create key', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/v1/api-keys/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setKeys((prev) => prev.filter((k) => k.id !== id))
      showToast('API key revoked')
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke key', 'error')
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-heading)' }}>API Keys</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Manage programmatic access tokens</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary" style={{ gap: 8 }}>
          <Plus style={{ width: 16, height: 16 }} />
          Create Key
        </button>
      </div>

      {newKeyVisible && (
        <div className="card" style={{ padding: 20, marginBottom: 20, border: '1px solid var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>Key Created</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Copy this key now. It won&apos;t be shown again.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 14, fontFamily: 'monospace', color: 'var(--text-heading)', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 8, wordBreak: 'break-all' }}>{newKeyVisible}</code>
                <button onClick={() => copyToClipboard(newKeyVisible)} className="btn btn-ghost" style={{ padding: 8, minHeight: 'auto', minWidth: 'auto' }} aria-label="Copy">
                  <Copy style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
            <button onClick={() => setNewKeyVisible(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Close">
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
        <input type="text" placeholder="Search keys..." value={search} onChange={(e) => setSearch(e.target.value)} className="input" style={{ paddingLeft: 36 }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Clear search">
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {error && filtered.length === 0 ? (
        <ErrorState message={error} onRetry={() => { setError(null); setKeys(initialKeys) }} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Key}
          title="No API keys"
          description={search ? 'Try a different search.' : 'Create an API key to access StockPilot programmatically.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((k) => (
            <div key={k.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-heading)' }}>{k.name}</span>
                    <span className="badge" style={{ background: k.isActive ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)', color: k.isActive ? 'var(--success)' : 'var(--danger)', fontSize: 12 }}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                  <p className="tabular" style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace', marginBottom: 6 }}>{k.keyPreview}...</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {k.scopes.map((s) => (
                      <span key={s} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{s}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                    {k.expiresAt && ` · Expires ${new Date(k.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                {k.isActive && (
                  <button onClick={() => handleRevoke(k.id)} disabled={loading} className="btn btn-ghost" style={{ gap: 4, color: 'var(--danger)', fontSize: 12, flexShrink: 0 }}>
                    <Trash2 style={{ width: 13, height: 13 }} />
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setShowCreateModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="surface-2" style={{ position: 'relative', width: '100%', maxWidth: 480, borderRadius: 12, border: '1px solid var(--border)', padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-heading)' }}>Create API Key</h2>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost" style={{ padding: 4, minHeight: 'auto', minWidth: 'auto' }} aria-label="Close"><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Name *</label>
                <input className="input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g., Production API" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Expires In (days)</label>
                <input className="input" type="number" min="1" value={createForm.expiresInDays} onChange={(e) => setCreateForm({ ...createForm, expiresInDays: e.target.value })} placeholder="90" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Scopes *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {availableScopes.map((s) => {
                    const selected = createForm.scopes.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setCreateForm({
                            ...createForm,
                            scopes: selected ? createForm.scopes.filter((x) => x !== s) : [...createForm.scopes, s],
                          })
                        }}
                        style={{
                          fontSize: 12, padding: '4px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid',
                          borderColor: selected ? 'var(--accent)' : 'var(--border)',
                          background: selected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                          color: selected ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
