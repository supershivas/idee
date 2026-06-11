'use client'
import { useState, useRef, useEffect } from 'react'
import { Page } from '../types'

export function ActionsMenu({ onDelete, onConvertToJournal, children }: {
  onDelete: () => void
  onConvertToJournal?: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-lg transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >···</button>
      {open && (
        <div className="absolute right-0 top-full mt-1 rounded-xl shadow-xl z-50 min-w-48 overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          {children}
          {onConvertToJournal && (
            <>
              <div style={{ borderTop: '1px solid var(--border-light)' }} />
              <button onClick={() => { onConvertToJournal(); setOpen(false) }}
                className="w-full text-left px-4 py-3 text-sm flex items-center gap-2 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span>📓</span> Convertir en entrée Journal
              </button>
            </>
          )}
          <div style={{ borderTop: '1px solid var(--border-light)' }} />
          <button onClick={() => { onDelete(); setOpen(false) }}
            className="w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-500 transition-colors"
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Mettre à la corbeille
          </button>
        </div>
      )}
    </div>
  )
}

export function ConfirmTrashModal({ page, onConfirm, onCancel }: {
  page: Page, onConfirm: () => void, onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center" onClick={onCancel}>
      <div className="rounded-t-2xl md:rounded-2xl shadow-xl p-5 w-full md:w-80 md:mx-4"
        style={{ background: 'var(--card-bg)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{page.icon || '📄'}</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{page.title || 'Sans titre'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Restaurable depuis la corbeille pendant 30 jours.</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-colors"
            style={{ background: 'var(--selected-bg)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--selected-bg)')}>
            Annuler
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-xl font-medium transition-colors">
            Mettre à la corbeille
          </button>
        </div>
        <div className="md:hidden" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}
