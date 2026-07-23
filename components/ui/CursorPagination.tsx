'use client';

import { Loader2 } from 'lucide-react';

interface Props {
  totalCount: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export function CursorPagination({ totalCount, hasMore, loading, onLoadMore }: Props) {
  return (
    <div className="flex items-center justify-between pt-4 text-sm text-[var(--text-secondary)]">
      <span>{totalCount} total</span>
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="px-4 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {loading ? 'Loading…' : 'Load More'}
        </button>
      )}
    </div>
  );
}
