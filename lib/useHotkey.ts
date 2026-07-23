'use client';

import { useEffect } from 'react';

type KeyCombo = string;

const COMBO_MAP: Record<string, { key: string; ctrlOrMeta: boolean }> = {};

function parseCombo(combo: KeyCombo) {
  const parts = combo.toLowerCase().split('+');
  const hasCtrl = parts.includes('ctrl');
  const hasMeta = parts.includes('mod') || parts.includes('meta');
  const hasCmd = parts.includes('cmd');
  const key =
    parts.filter((p) => !['ctrl', 'meta', 'mod', 'cmd', 'alt', 'shift'].includes(p))[0] || '';
  return {
    key,
    ctrlOrMeta: hasCtrl || hasMeta || hasCmd,
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
  };
}

export function useHotkey(
  combo: KeyCombo,
  handler: (e: KeyboardEvent) => void,
  options?: { enabled?: boolean }
) {
  useEffect(() => {
    if (options?.enabled === false) return;

    const parsed = parseCombo(combo);

    const listener = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      // '/' should work even in input to focus search
      if (isInput && e.key !== '/') return;

      if (parsed.ctrlOrMeta && !e.metaKey && !e.ctrlKey) return;
      if (parsed.alt && !e.altKey) return;
      if (parsed.shift && !e.shiftKey) return;

      const targetKey = e.key.toLowerCase();
      if (targetKey !== parsed.key) return;

      e.preventDefault();
      handler(e);
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [combo, handler, options?.enabled]);
}
