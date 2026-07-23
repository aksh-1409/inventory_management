'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        onClick={onCancel}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
      />
      <div
        ref={modalRef}
        className="surface-2"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          borderRadius: 'var(--radius-card)',
          padding: 24,
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                variant === 'destructive' ? 'rgba(255,32,71,0.12)' : 'rgba(59,158,255,0.12)',
            }}
          >
            <AlertTriangle
              style={{
                width: 18,
                height: 18,
                color: variant === 'destructive' ? 'var(--danger)' : 'var(--accent)',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <h2
              id="confirm-modal-title"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-heading)',
                marginBottom: 4,
              }}
            >
              {title}
            </h2>
            <p
              style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 'var(--lh-body)' }}
            >
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            className={`btn ${variant === 'destructive' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
            style={
              variant === 'destructive'
                ? {
                    background: 'var(--danger)',
                    color: 'white',
                  }
                : undefined
            }
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
