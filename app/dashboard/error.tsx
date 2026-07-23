'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error('[DASHBOARD_ERROR]', error)
  return (
    <div className="p-8">
      <ErrorState title="Dashboard error" message={error.message || 'Something went wrong.'} onRetry={reset} />
    </div>
  )
}
