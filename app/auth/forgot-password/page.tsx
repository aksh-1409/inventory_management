'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Package } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Unable to submit the request.');
        setLoading(false);
        return;
      }
      window.location.href = data.statusUrl;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #8b5cf6, #4f46e5)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Package style={{ width: 20, color: 'white' }} />
          </div>
          <strong style={{ color: 'white', fontSize: 24 }}>StockPilot</strong>
        </div>

        <section className="card" style={{ padding: 32 }}>
          <Link
            href="/auth/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-muted)',
              fontSize: 13,
              textDecoration: 'none',
              marginBottom: 18,
            }}
          >
            <ArrowLeft style={{ width: 14 }} /> Back to sign in
          </Link>
          <h1 style={{ color: 'var(--text-heading)', fontSize: 24, marginBottom: 6 }}>
            Request a password reset
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 14,
              lineHeight: 1.5,
              marginBottom: 24,
            }}
          >
            Enter your operator login email. An administrator will approve or reject the request in
            StockPilot.
          </p>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                color: 'var(--danger)',
                background: 'rgba(239,68,68,0.1)',
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                color: 'var(--text-secondary)',
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              Login email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="input"
              placeholder="operator@example.com"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}
            >
              {loading && <Loader2 style={{ width: 15, animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Submitting...' : 'Ask administrator'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
