'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Package, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

interface Warehouse {
  id: string;
  name: string;
}

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  warehouseId: z.string().min(1, 'Please select a warehouse'),
});

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/v1/warehouses')
      .then((r) => r.json())
      .then((d) => setWarehouses(d.warehouses || []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = signupSchema.safeParse({ name, email, password, warehouseId });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, warehouseId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/auth/login?registered=true'), 1500);
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const passwordStrength =
    password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 16px',
    color: 'white',
    fontSize: 14,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 8,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -160,
            width: 320,
            height: 320,
            background: 'rgba(139,92,246,0.2)',
            borderRadius: '50%',
            filter: 'blur(96px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -160,
            left: -160,
            width: 320,
            height: 320,
            background: 'rgba(79,70,229,0.2)',
            borderRadius: '50%',
            filter: 'blur(96px)',
          }}
        />
      </div>

      <div style={{ width: '100%', maxWidth: 448, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, #8b5cf6, #4f46e5)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package style={{ width: 20, height: 20, color: 'white' }} />
          </div>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
            StockPilot
          </span>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: 'white', marginBottom: 4 }}>
              Create an account
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(161,161,170,1)' }}>
              Register as an <span style={{ color: '#a78bfa', fontWeight: 500 }}>Operator</span> and
              select your warehouse.
            </p>
          </div>

          {success && (
            <div
              style={{
                marginBottom: 16,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.2)',
                color: 'rgba(74,222,128,1)',
                fontSize: 14,
                padding: '12px 16px',
                borderRadius: 8,
              }}
            >
              <CheckCircle2 style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
              <span>Account created! Redirecting to login...</span>
            </div>
          )}

          {error && (
            <div
              style={{
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
              }}
            >
              <AlertCircle style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Mike Johnson"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="mike@urbansole.com"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 8 characters"
                  style={{ ...inputStyle, paddingRight: 40 }}
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
                  }}
                >
                  {showPassword ? (
                    <EyeOff style={{ width: 16, height: 16 }} />
                  ) : (
                    <Eye style={{ width: 16, height: 16 }} />
                  )}
                </button>
              </div>
              {password.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        style={{
                          height: 4,
                          flex: 1,
                          borderRadius: 2,
                          background:
                            passwordStrength >= level
                              ? level === 1
                                ? '#ef4444'
                                : level === 2
                                  ? '#eab308'
                                  : '#22c55e'
                              : 'rgba(255,255,255,0.1)',
                          transition: 'background 300ms var(--ease)',
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(161,161,170,0.6)' }}>
                    {strengthLabels[passwordStrength]}
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 5l3 3 3-3'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: 36,
                }}
              >
                <option value="">Select warehouse...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} style={{ background: '#1a1a24', color: 'white' }}>
                    {w.name}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: 'rgba(161,161,170,0.5)', marginTop: 4 }}>
                You&apos;ll only see inventory and transfers for this warehouse.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || success}
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
              }}
            >
              {loading ? (
                <>
                  <Loader2
                    style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }}
                  />{' '}
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p
            style={{
              marginTop: 24,
              textAlign: 'center',
              fontSize: 14,
              color: 'rgba(161,161,170,0.6)',
            }}
          >
            Already have an account?{' '}
            <Link
              href="/auth/login"
              style={{ color: '#a78bfa', fontWeight: 500, textDecoration: 'none' }}
            >
              Sign in
            </Link>
          </p>
        </div>

        <p
          style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'rgba(113,113,122,1)' }}
        >
          StockPilot — Multi-warehouse inventory control
        </p>
      </div>
    </div>
  );
}
