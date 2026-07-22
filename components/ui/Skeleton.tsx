export function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border)]">
      <td colSpan={6} style={{ padding: '16px 24px' }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 w-1/3">
            <div className="skeleton w-8 h-8 flex-shrink-0" />
            <div className="space-y-2 w-full">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          </div>
          <div className="skeleton h-4 w-20 hidden md:block" />
          <div className="skeleton h-6 w-16" />
          <div className="skeleton h-4 w-12 hidden lg:block" />
        </div>
      </td>
    </tr>
  )
}

export function SkeletonCard() {
  return (
    <div className="card p-5 w-full">
      <div className="flex items-center gap-4 mb-4">
        <div className="skeleton w-10 h-10 flex-shrink-0" />
        <div className="space-y-2 w-full">
          <div className="skeleton h-3 w-1/3" />
          <div className="skeleton h-6 w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonText({ className = '' }: { className?: string }) {
  return <div className={`skeleton h-4 w-full ${className}`} />
}
