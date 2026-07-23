'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertCircle, X, RotateCcw } from 'lucide-react'

export type ToastType = 'success' | 'error'

interface ToastMessage {
  id: string
  message: string
  type: ToastType
  onUndo?: () => void
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, onUndo?: () => void) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'success', onUndo?: () => void) => {
    setToast({ id: Math.random().toString(), message, type, onUndo })
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[200] flex animate-[toast-in_200ms_cubic-bezier(0.4,0,0.2,1)_forwards]"
        >
          <div className="surface-2 border border-[var(--border)] rounded-xl p-4 shadow-xl shadow-black/50 min-w-[300px] relative overflow-hidden flex items-start gap-3">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[var(--success)] flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-heading)]">{toast.message}</p>
            </div>
            <div className="flex items-center gap-1">
              {toast.onUndo && (
                <button
                  onClick={() => { toast.onUndo?.(); setToast(null) }}
                  className="text-[var(--accent)] hover:text-[var(--text-heading)] transition-colors cursor-pointer p-1"
                  title="Undo"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setToast(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="absolute bottom-0 left-0 h-1 bg-[var(--border)] w-full">
              <div
                className={`h-full animate-[toast-progress_4s_linear_forwards] ${
                  toast.type === 'success' ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'
                }`}
              />
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
