'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

interface ExportButtonProps {
  csvUrl: string;
  pdfUrl: string;
  label?: string;
}

export function ExportButton({ csvUrl, pdfUrl, label = 'Export' }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost"
        onClick={() => setOpen((o) => !o)}
        style={{ gap: 6, fontSize: 13 }}
        aria-label="Export options"
        aria-expanded={open}
      >
        <Download style={{ width: 14, height: 14 }} />
        {label}
      </button>
      {open && (
        <div
          className="surface-3"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            borderRadius: 'var(--radius-default)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            minWidth: 160,
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
          role="menu"
        >
          <a
            href={csvUrl}
            role="menuitem"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              fontSize: 13,
              color: 'var(--text-heading)',
              textDecoration: 'none',
              transition: 'background 100ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => setOpen(false)}
          >
            <FileSpreadsheet style={{ width: 14, height: 14, color: 'var(--success)' }} />
            Export as CSV
          </a>
          <a
            href={pdfUrl}
            role="menuitem"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              fontSize: 13,
              color: 'var(--text-heading)',
              textDecoration: 'none',
              transition: 'background 100ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => setOpen(false)}
          >
            <FileText style={{ width: 14, height: 14, color: 'var(--danger)' }} />
            Export as PDF
          </a>
        </div>
      )}
    </div>
  );
}
