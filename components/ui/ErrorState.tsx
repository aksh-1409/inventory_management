import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: Props) {
  return (
    <div className="card p-10 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-[rgba(248,113,113,0.1)] flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-[var(--danger)]" />
      </div>
      <h3 className="text-lg font-medium text-[var(--text-heading)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-ghost border border-[var(--border)]">
          <RefreshCcw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
