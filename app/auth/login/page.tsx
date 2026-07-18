'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Package, Loader2, AlertCircle } from 'lucide-react'

const DEMO_ACCOUNTS = [
  { label: 'Sarah (Admin)', email: 'sarah@urbansole.com', password: 'password123' },
  { label: 'Mike (Operator)', email: 'mike@urbansole.com', password: 'password123' },
]

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      setError(res.error)
    } else {
      router.push(callbackUrl)
      router.refresh()
    }
  }

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[0]) {
    setEmail(account.email)
    setPassword(account.password)
    setError(null)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 16px',
    color: 'white',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 200ms ease, box-shadow 200ms ease',
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 16,
      padding: 32,
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
    }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'white', marginBottom: 4 }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: 'rgba(161,161,170,1)' }}>Sign in to your inventory control tower</p>
      </div>

      {/* Demo Account Quick-Fill */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: 'rgba(161,161,170,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Quick Demo</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account)}
              style={{
                flex: 1,
                fontSize: 12,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(212,212,216,1)',
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.color = 'rgba(212,212,216,1)'
              }}
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 12, color: 'rgba(161,161,170,0.6)', whiteSpace: 'nowrap' }}>or continue with email</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: 'rgba(248,113,113,1)',
          fontSize: 14,
          padding: '12px 16px',
          borderRadius: 8,
        }}>
          <AlertCircle style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="email" style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'rgba(212,212,216,1)', marginBottom: 6 }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="sarah@urbansole.com"
            style={inputStyle}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(139,92,246,0.15)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="password" style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'rgba(212,212,216,1)', marginBottom: 6 }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••"
              style={{ ...inputStyle, paddingRight: 40 }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(139,92,246,0.15)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'rgba(161,161,170,0.6)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
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
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 200ms ease',
          }}
          onMouseEnter={e => {
            if (!loading) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6, #6366f1)'
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed, #4f46e5)'
          }}
        >
          {loading ? (
            <>
              <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: 'rgba(161,161,170,0.6)' }}>
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/signup"
          style={{ color: 'rgba(167,139,250,1)', fontWeight: 500, textDecoration: 'none' }}
        >
          Create one
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background gradient orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -160, right: -160, width: 320, height: 320, background: 'rgba(139,92,246,0.2)', borderRadius: '50%', filter: 'blur(96px)' }} />
        <div style={{ position: 'absolute', bottom: -160, left: -160, width: 320, height: 320, background: 'rgba(79,70,229,0.2)', borderRadius: '50%', filter: 'blur(96px)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 384, height: 384, background: 'rgba(88,28,135,0.1)', borderRadius: '50%', filter: 'blur(96px)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 448, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, #8b5cf6, #4f46e5)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 15px -3px rgba(139,92,246,0.25)',
          }}>
            <Package style={{ width: 20, height: 20, color: 'white' }} />
          </div>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>StockPilot</span>
        </div>

        {/* Suspense Wrapper */}
        <Suspense
          fallback={
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 300,
            }}>
              <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', color: '#8b5cf6', marginBottom: 16 }} />
              <p style={{ color: 'rgba(161,161,170,1)', fontSize: 14 }}>Loading login terminal...</p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'rgba(113,113,122,1)' }}>
          StockPilot — Multi-warehouse inventory control
        </p>
      </div>
    </div>
  )
}
