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
      <button onClick={() => setOpen(v => !v)}
        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-lg">···</button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-48 overflow-hidden">
          {children}
          {onConvertToJournal && (
            <>
              <div className="border-t border-gray-100" />
              <button onClick={() => { onConvertToJournal(); setOpen(false) }}
                className="w-full text-left px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                <span>📓</span> Convertir en entrée Journal
              </button>
            </>
          )}
          <div className="border-t border-gray-100" />
          <button onClick={() => { onDelete(); setOpen(false) }}
            className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50">
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
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center" onClick={onCancel}>
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl p-5 w-full md:w-80 md:mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{page.icon || '📄'}</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{page.title || 'Sans titre'}</p>
            <p className="text-xs text-gray-400 mt-0.5">Restaurable depuis la corbeille pendant 30 jours.</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium">
            Annuler
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-xl font-medium">
            Mettre à la corbeille
          </button>
        </div>
        <div className="md:hidden" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}
