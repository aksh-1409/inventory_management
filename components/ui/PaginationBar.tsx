'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface Props {
  total: number;
  page: number;
  pageSize: number;
}

export function PaginationBar({ total, page, pageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);

  const go = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(p));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4 text-sm text-[var(--text-secondary)]">
      <span>
        {total === 0
          ? '0 results'
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 rounded-md border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--bg-surface-hover)]"
        >
          Prev
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 3, totalPages - 6));
          const p = start + i;
          if (p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => go(p)}
              className={`px-3 py-1 rounded-md border border-[var(--border)] ${
                p === page ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 rounded-md border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--bg-surface-hover)]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
