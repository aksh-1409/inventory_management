'use client'

import { useSession } from 'next-auth/react'
import { User, Mail, Shield, Warehouse, Calendar } from 'lucide-react'

interface Props {
  profile: {
    id: string
    name: string
    email: string
    role: string
    warehouseName: string | null
    createdAt: string
  }
}

export default function ProfileClient({ profile }: Props) {
  const { data: session } = useSession()
  const isOperator = profile.role === 'OPERATOR'

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 32, paddingTop: 8 }}>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 400, color: 'var(--text-heading)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>Profile</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Your account information</p>
      </div>

      <div className="card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 600, color: 'white',
            border: '1px solid var(--border)',
          }}>
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-heading)' }}>{profile.name}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{profile.email}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</p>
              <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>{profile.name}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</p>
              <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>{profile.email}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</p>
              <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>{profile.role}</p>
            </div>
          </div>

          {isOperator && profile.warehouseName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Warehouse style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Warehouse</p>
                <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>{profile.warehouseName}</p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member Since</p>
              <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>{new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
