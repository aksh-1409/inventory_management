'use client';

import { useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/components/ui/Toast';

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : undefined;
}

function patchFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = getCookie(CSRF_COOKIE);
    if (token) {
      const headers = new Headers(init?.headers);
      headers.set(CSRF_HEADER, token);
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    patchFetch();
  }, []);

  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
