'use client'
import { useState } from 'react'
import { Page } from '../types'

export function TrashPanel({ trashedPages, onRestore, onDeleteForever, onClose }: {
  trashedPages: Page[]
  onRestore: (id: string) => void
  onDeleteForever: (id: string) => void
  onClose: () => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const sorted = [...trashedPages].sort((a, b) =>
    new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()
  )

  function daysLeft(deletedAt: string) {
    return Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col w-full md:w-[480px]"
        style={{ maxHeight: '80vh' }}>
        <div className="md:hidden w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">Corbeille</h2>
            <p className="text-xs text-gray-400 mt-0.5">Suppression définitive après 30 jours</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <span className="text-4xl mb-3">🗑️</span>
              <p className="text-sm">La corbeille est vide</p>
            </div>
          ) : sorted.map(page => (
            <div key={page.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 hover:bg-gray-50">
              <span className="text-2xl flex-shrink-0 opacity-60">{page.icon || '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{page.title || 'Sans titre'}</p>
                <p className="text-xs text-gray-400">
                  {daysLeft(page.deleted_at!) > 0
                    ? `Suppression dans ${daysLeft(page.deleted_at!)} jour${daysLeft(page.deleted_at!) > 1 ? 's' : ''}`
                    : 'Suppression imminente'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onRestore(page.id)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  Restaurer
                </button>
                {confirmId === page.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { onDeleteForever(page.id); setConfirmId(null) }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg">
                      Confirmer
                    </button>
                    <button onClick={() => setConfirmId(null)} className="px-2 py-1.5 text-xs text-gray-400 rounded-lg">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(page.id)}
                    className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg">
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {sorted.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
            {confirmId === 'all' ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Vider définitivement ?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmId(null)} className="px-3 py-1.5 text-sm text-gray-500">Annuler</button>
                  <button onClick={() => { sorted.forEach(p => onDeleteForever(p.id)); setConfirmId(null) }}
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">
                    Tout supprimer
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmId('all')} className="text-sm text-red-400 hover:text-red-600">
                Vider la corbeille
              </button>
            )}
          </div>
        )}
        <div className="md:hidden" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}
