'use client';

import { useState } from 'react';
import { User, Mail, Shield, Warehouse, Calendar, Key, Loader2, Eye, EyeOff } from 'lucide-react';

interface Props {
  profile: {
    id: string;
    name: string;
    email: string;
    role: string;
    warehouseName: string | null;
    createdAt: string;
    hasPassword: boolean;
    passwordChangedAt: string | null;
  };
}

export default function ProfileClient({ profile }: Props) {
  const isOperator = profile.role === 'OPERATOR';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const res = await fetch('/api/auth/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'white',
    fontSize: 14,
    outline: 'none',
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 32, paddingTop: 8 }}>
        <h1
          style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 400,
            color: 'var(--text-heading)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          Profile
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          Your account information
        </p>
      </div>

      <div className="card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 600,
              color: 'white',
              border: '1px solid var(--border)',
            }}
          >
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-heading)' }}>
              {profile.name}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{profile.email}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Full Name
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>
                {profile.name}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mail style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Email
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>
                {profile.email}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Role
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>
                {profile.role}
              </p>
            </div>
          </div>

          {isOperator && profile.warehouseName && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Warehouse style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
              </div>
              <div>
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Assigned Warehouse
                </p>
                <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>
                  {profile.warehouseName}
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Member Since
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-heading)', fontWeight: 500 }}>
                {new Date(profile.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {profile.hasPassword && (
        <div className="card" style={{ padding: 32, marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Key style={{ width: 18, height: 18, color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-heading)' }}>
              Change Password
            </h3>
          </div>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(34,197,94,0.1)',
                color: '#22c55e',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              Password changed successfully.
            </div>
          )}

          <form
            onSubmit={handleChangePassword}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Current Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  {showCurrent ? (
                    <EyeOff style={{ width: 14, height: 14 }} />
                  ) : (
                    <Eye style={{ width: 14, height: 14 }} />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  {showNew ? (
                    <EyeOff style={{ width: 14, height: 14 }} />
                  ) : (
                    <Eye style={{ width: 14, height: 14 }} />
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                border: 'none',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {loading && (
                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
              )}
              {loading ? 'Saving...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
