import React from 'react'

interface Props {
  icon: React.ElementType
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: Props) {
  return (
    <div className="card p-10 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.04)] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-lg font-medium text-[var(--text-heading)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">
        {description}
      </p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn btn-primary">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
