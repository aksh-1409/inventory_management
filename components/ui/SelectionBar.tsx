'use client';

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface SelectionBarProps {
  count: number;
  totalCount: number;
  isAllPages: boolean;
  entityLabel: string;
  onClear: () => void;
  onDeleteSelected: () => Promise<void>;
  deleteLabel?: string;
}

export function SelectionBar({
  count,
  totalCount,
  isAllPages,
  entityLabel,
  onClear,
  onDeleteSelected,
  deleteLabel = 'Delete',
}: SelectionBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  if (count === 0 && !isAllPages) return null;

  const label = isAllPages
    ? `All ${totalCount} ${entityLabel} selected`
    : `${count} ${entityLabel} selected`;

  async function handleDelete() {
    setLoading(true);
    try {
      await onDeleteSelected();
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'rgba(59,158,255,0.08)',
          borderBottom: '1px solid var(--border)',
          gap: 8,
          flexWrap: 'wrap',
        }}
        role="status"
        aria-live="polite"
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={onClear}
            style={{ fontSize: 13, padding: '4px 12px', minHeight: 32 }}
          >
            <X style={{ width: 12, height: 12 }} />
            Clear
          </button>
          <button
            className="btn btn-danger"
            onClick={() => setShowConfirm(true)}
            style={{ fontSize: 13, padding: '4px 12px', minHeight: 32 }}
          >
            <Trash2 style={{ width: 12, height: 12 }} />
            {deleteLabel}
          </button>
        </div>
      </div>
      <ConfirmModal
        open={showConfirm}
        title={`Delete ${label}?`}
        message={`This will soft-delete the selected ${entityLabel}. This action can be undone.`}
        confirmLabel={loading ? 'Deleting...' : 'Delete'}
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
        loading={loading}
      />
    </>
  );
}
