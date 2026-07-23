'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[ROOT_ERROR]', error);
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <ErrorState
        title="Unexpected error"
        message={error.message || 'Something went wrong. Please try again.'}
        onRetry={reset}
      />
    </div>
  );
}
