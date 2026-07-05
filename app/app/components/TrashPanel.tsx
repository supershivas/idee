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

  // Une page supprimée avec son parent est restaurée/purgée avec lui :
  // on n'affiche que les racines de chaque sous-arbre supprimé.
  const trashedIds = new Set(trashedPages.map(p => p.id))
  const roots = trashedPages.filter(p => !p.parent_id || !trashedIds.has(p.parent_id))
  function countDescendants(id: string): number {
    return trashedPages
      .filter(p => p.parent_id === id)
      .reduce((acc, c) => acc + 1 + countDescendants(c.id), 0)
  }

  const sorted = [...roots].sort((a, b) =>
    new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()
  )

  function daysLeft(deletedAt: string) {
    return Math.max(0, 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col w-full md:w-[480px]"
        style={{ background: 'var(--card-bg)', maxHeight: '80vh' }}>
        <div className="md:hidden w-10 h-1 rounded-full mx-auto mt-3 flex-shrink-0" style={{ background: 'var(--border)' }} />
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Corbeille</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Suppression définitive après 30 jours</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
              <span className="text-4xl mb-3">🗑️</span>
              <p className="text-sm">La corbeille est vide</p>
            </div>
          ) : sorted.map(page => (
            <div key={page.id} className="flex items-center gap-3 px-5 py-3 transition-colors"
              style={{ borderBottom: '1px solid var(--border-light)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="text-2xl flex-shrink-0 opacity-60">{page.icon || '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{page.title || 'Sans titre'}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {daysLeft(page.deleted_at!) > 0
                    ? `Suppression dans ${daysLeft(page.deleted_at!)} jour${daysLeft(page.deleted_at!) > 1 ? 's' : ''}`
                    : 'Suppression imminente'}
                  {countDescendants(page.id) > 0 && ` · ${countDescendants(page.id)} sous-page${countDescendants(page.id) > 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onRestore(page.id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
                  Restaurer
                </button>
                {confirmId === page.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { onDeleteForever(page.id); setConfirmId(null) }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
                      Confirmer
                    </button>
                    <button onClick={() => setConfirmId(null)} className="px-2 py-1.5 text-xs rounded-lg" style={{ color: 'var(--text-muted)' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(page.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                    style={{ color: 'var(--text-faint)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent' }}>
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {sorted.length > 0 && (
          <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            {confirmId === 'all' ? (
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Vider définitivement ?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmId(null)} className="px-3 py-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>Annuler</button>
                  <button onClick={() => { sorted.forEach(p => onDeleteForever(p.id)); setConfirmId(null) }}
                    className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                    Tout supprimer
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmId('all')} className="text-sm text-red-400 hover:text-red-500 transition-colors">
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
