'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  placeholder?: string;
}

export function SearchInput({ placeholder = 'Search…' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') || '');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(searchParams.get('q') || '');
  }, [searchParams]);

  const navigate = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) {
        params.set('q', q);
      } else {
        params.delete('q');
      }
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => navigate(v), 300);
    },
    [navigate]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] w-full max-w-xs"
    />
  );
}
