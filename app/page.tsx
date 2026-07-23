import Link from 'next/link';
import { Package, Warehouse, ArrowRightLeft, BarChart3, Shield, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 40px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Package style={{ width: 24, height: 24, color: '#8b5cf6' }} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
            StockPilot
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link
            href="/auth/login"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              color: '#a1a1aa',
              textDecoration: 'none',
              borderRadius: 8,
              transition: 'color 150ms',
            }}
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              background: '#8b5cf6',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: 8,
              fontWeight: 500,
              transition: 'opacity 150ms',
            }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '80px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div
            style={{
              display: 'inline-block',
              padding: '6px 14px',
              borderRadius: 20,
              background: 'rgba(139,92,246,0.12)',
              color: '#8b5cf6',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              marginBottom: 24,
            }}
          >
            OPEN SOURCE &middot; SELF-HOSTED
          </div>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginBottom: 20,
            }}
          >
            Multi-warehouse
            <br />
            inventory management
          </h1>
          <p
            style={{
              fontSize: 17,
              color: '#71717a',
              maxWidth: 520,
              margin: '0 auto 36px',
              lineHeight: 1.6,
            }}
          >
            A control tower for physical goods — showing exactly what is where, alerting when stock
            runs low, and orchestrating safe transfers between locations.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/auth/signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                fontSize: 14,
                background: '#8b5cf6',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: 10,
                fontWeight: 600,
                transition: 'opacity 150ms',
              }}
            >
              Start free <ArrowRightLeft style={{ width: 16, height: 16 }} />
            </Link>
            <a
              href="https://github.com/aksh-1409/inventory_management"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                fontSize: 14,
                background: 'rgba(255,255,255,0.06)',
                color: '#d4d4d8',
                textDecoration: 'none',
                borderRadius: 10,
                fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.08)',
                transition: 'background 150ms',
              }}
            >
              View on GitHub
            </a>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 72,
          }}
        >
          {[
            {
              icon: Warehouse,
              title: 'Multi-Warehouse',
              desc: 'Track stock across all your locations with a real-time products × warehouses matrix.',
            },
            {
              icon: ArrowRightLeft,
              title: 'Transfer Workflow',
              desc: 'Request → Accept → Ship → Receive. Full audit trail with packing slips and receiving reports.',
            },
            {
              icon: BarChart3,
              title: 'Dashboard & Reports',
              desc: 'Color-coded stock levels, low-stock alerts, recent activity feed, and downloadable PDFs.',
            },
            {
              icon: Shield,
              title: 'Role-Based Access',
              desc: 'Admin and Operator roles. Operators scoped to their warehouse, admins see everything.',
            },
            {
              icon: Zap,
              title: 'REST API',
              desc: 'Full API with API key authentication, idempotency support, and webhook integrations.',
            },
            {
              icon: Package,
              title: 'Self-Hosted',
              desc: 'Clone, configure, deploy. Your data stays on your server. Docker and Render ready.',
            },
          ].map((f) => (
            <div
              key={f.title}
              style={{
                padding: 24,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
                transition: 'border-color 200ms',
              }}
            >
              <f.icon style={{ width: 20, height: 20, color: '#8b5cf6', marginBottom: 12 }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p style={{ fontSize: 13, color: '#52525b' }}>
            Built with Next.js, TypeScript, Prisma, PostgreSQL &middot; MIT License
          </p>
        </div>
      </main>
    </div>
  );
}
