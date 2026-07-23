import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="card p-10 flex flex-col items-center justify-center text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.04)] flex items-center justify-center mb-4">
          <span className="text-2xl font-bold text-[var(--text-muted)]">404</span>
        </div>
        <h1 className="text-lg font-medium text-[var(--text-heading)] mb-1">Page not found</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
