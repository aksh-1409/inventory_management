'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  required,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setFocusedIndex(options.findIndex((o) => o.value === value));
  }, [open, options, value]);

  const selected = options.find((o) => o.value === value);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            onChange(options[focusedIndex].value);
            setOpen(false);
          }
          break;
        case 'Tab':
          setOpen(false);
          break;
      }
    },
    [open, focusedIndex, options, onChange]
  );

  useEffect(() => {
    if (open && listRef.current && focusedIndex >= 0) {
      const el = listRef.current.children[focusedIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, open]);

  const selectId = id || `custom-select-${placeholder.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        id={selectId}
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${selectId}-listbox`}
        aria-label={placeholder}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-input)',
          padding: '8px 12px',
          color: selected ? 'var(--text-heading)' : 'var(--text-muted)',
          fontSize: 14,
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'border-color 150ms ease',
          minHeight: 44,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          style={{
            width: 14,
            height: 14,
            flexShrink: 0,
            marginLeft: 8,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          id={`${selectId}-listbox`}
          role="listbox"
          aria-label={placeholder}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: '#1a1a24',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 200,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 14, color: 'var(--text-muted)' }}>
              No options
            </div>
          ) : (
            options.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                onMouseEnter={() => setFocusedIndex(i)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 14,
                  color: opt.value === value ? 'white' : 'var(--text-heading)',
                  background:
                    i === focusedIndex
                      ? 'rgba(59,158,255,0.12)'
                      : opt.value === value
                        ? 'rgba(139,92,246,0.2)'
                        : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background 100ms ease',
                  minHeight: 40,
                }}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}

      {required && !value && (
        <span
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
          aria-hidden="true"
          data-required-select="true"
        />
      )}
    </div>
  );
}
