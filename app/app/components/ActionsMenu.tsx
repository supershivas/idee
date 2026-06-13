'use client'
import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Page } from '../types'

const IconDots = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <circle cx="2.5" cy="7" r="1.3" />
    <circle cx="7"   cy="7" r="1.3" />
    <circle cx="11.5" cy="7" r="1.3" />
  </svg>
)

const IconNotebook = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
    stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1.5" y="1" width="10" height="11" rx="1.5" />
    <path d="M4.5 1v11" />
    <path d="M7 4h2.5" />
    <path d="M7 6.5h1.5" />
  </svg>
)

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
    stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 3.5h10" />
    <path d="M4.5 3.5V2.5A.5.5 0 0 1 5 2h3a.5.5 0 0 1 .5.5v1" />
    <path d="M3 3.5l.7 7.5h5.6L10 3.5" />
  </svg>
)

function MenuButton({ icon, label, onClick, danger }: {
  icon: ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  const base = danger ? '#ef4444' : 'var(--text-secondary)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-colors text-left"
      style={{ color: base, background: 'transparent' }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.07)' : 'var(--hover-bg)'
        e.currentTarget.style.color = danger ? '#f87171' : 'var(--text-primary)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = base
      }}
    >
      <span style={{ opacity: 0.55 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

export function ActionsMenu({ onDelete, onConvertToJournal, children }: {
  onDelete: () => void
  onConvertToJournal?: () => void
  children?: ReactNode
}) {
  const [open, setOpen]       = useState(false)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Plus d'actions"
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
        style={{
          background: open ? 'var(--hover-bg)' : 'transparent',
          color: open ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
      >
        <IconDots />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50"
          style={{
            width: '212px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            transformOrigin: 'top right',
            opacity:   visible ? 1 : 0,
            transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(-6px)',
            transition: visible
              ? 'opacity 130ms ease, transform 230ms cubic-bezier(0.34, 1.45, 0.64, 1)'
              : 'none',
          }}
        >
          {children && <div className="p-1">{children}</div>}
          {children && <div style={{ height: '1px', background: 'var(--border)' }} />}
          <div className="p-1">
            {onConvertToJournal && (
              <MenuButton
                icon={<IconNotebook />}
                label="Convertir en Journal"
                onClick={() => { onConvertToJournal(); setOpen(false) }}
              />
            )}
            <MenuButton
              icon={<IconTrash />}
              label="Mettre à la corbeille"
              onClick={() => { onDelete(); setOpen(false) }}
              danger
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function ConfirmTrashModal({ page, onConfirm, onCancel }: {
  page: Page
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center" onClick={onCancel}>
      <div
        className="rounded-t-2xl md:rounded-2xl shadow-xl p-5 w-full md:w-80 md:mx-4"
        style={{ background: 'var(--card-bg)' }}
        onClick={e => e.stopPropagation()}
      >
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
            className="flex-1 py-2.5 px-3 text-sm text-white bg-red-500 hover:bg-red-600 rounded-xl font-medium transition-colors leading-tight">
            Corbeille
          </button>
        </div>
        <div className="md:hidden" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}
