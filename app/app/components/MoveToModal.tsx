'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Page } from '../types'
import { normalizeStr, getDescendantIds } from '../utils'
import { useSwipeDownToDismiss, useBackgroundScrollLock } from './MobileNav'

// Modal « Déplacer vers… » : choisit un nouveau parent pour la page (la page
// elle-même et ses descendants sont exclus des candidats).
//
// On navigue dans l'arborescence au lieu de choisir dans une liste à plat :
// une liste à plat de douze pages ne dit pas où l'on atterrit, et ne permet
// pas d'atteindre une sous-page profonde. Chaque ligne s'ouvre au toucher ;
// le bouton en bout de ligne y dépose la page. La recherche, elle, reste
// toujours accessible en haut et bascule en résultats à plat.
export function MoveToModal({ page, pages, onMove, onClose }: {
  page: Page
  pages: Page[]
  onMove: (parentId: string | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  // Dossier courant : null = racine.
  const [currentId, setCurrentId] = useState<string | null>(page.parent_id ?? null)
  const inputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const swipe = useSwipeDownToDismiss(onClose, contentRef)
  const backdropRef = useBackgroundScrollLock()

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const excluded = useMemo(
    () => new Set([page.id, ...getDescendantIds(pages, page.id)]),
    [page.id, pages]
  )
  const candidates = useMemo(
    () => pages.filter(p => !p.deleted_at && p.type !== 'journal' && !excluded.has(p.id)),
    [pages, excluded]
  )

  const searching = query.trim().length > 0
  const results = useMemo(() => {
    if (!searching) return []
    return candidates.filter(p => normalizeStr(p.title || '').includes(normalizeStr(query))).slice(0, 30)
  }, [candidates, query, searching])

  const children = useMemo(
    () => candidates.filter(p => (p.parent_id ?? null) === currentId),
    [candidates, currentId]
  )

  // Chemin de la racine jusqu'au dossier courant, pour le fil d'Ariane.
  const path = useMemo(() => {
    const crumbs: Page[] = []
    let id = currentId
    while (id) {
      const found = pages.find(p => p.id === id)
      if (!found) break
      crumbs.unshift(found)
      id = found.parent_id ?? null
    }
    return crumbs
  }, [currentId, pages])

  const currentIsOrigin = (page.parent_id ?? null) === currentId
  const hasChildren = (p: Page) => candidates.some(c => (c.parent_id ?? null) === p.id)

  function Row({ p }: { p: Page }) {
    return (
      <div className="w-full flex items-center" style={{ color: 'var(--text-primary)' }}>
        <button onClick={() => { setQuery(''); setCurrentId(p.id) }}
          className="u-hover-bg flex-1 min-w-0 flex items-center gap-3 px-4 py-2.5 text-sm text-left">
          <span className="flex-shrink-0">{p.icon || '📄'}</span>
          <span className="flex-1 truncate">{p.title || 'Sans titre'}</span>
          {hasChildren(p) && (
            <i className="ti ti-chevron-right flex-shrink-0" style={{ fontSize: '14px', color: 'var(--text-faint)' }} />
          )}
        </button>
        <button onClick={() => onMove(p.id)} title="Déplacer ici"
          className="u-hover-bg flex-shrink-0 flex items-center justify-center rounded-lg mr-2"
          style={{ width: 40, height: 40, color: 'var(--accent)' }}>
          <i className="ti ti-corner-down-right" style={{ fontSize: '17px' }} />
        </button>
      </div>
    )
  }

  return (
    <div ref={backdropRef} className="fixed inset-0 z-[400] flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={swipe.sheetRef}
        className="w-full md:w-[420px] md:mx-4 flex flex-col rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{ maxHeight: '85vh', background: 'var(--card-bg)', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', border: '1px solid var(--border)', ...swipe.style }}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 md:hidden" style={{ background: 'var(--border)' }} />

        {/* Recherche : toujours en haut, hors de la zone qui défile. */}
        <div className="px-4 pt-3 pb-3 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <i className="ti ti-search" style={{ color: 'var(--text-muted)', fontSize: '15px' }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une page…"
            className="flex-1 outline-none text-sm min-w-0"
            style={{ color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', caretColor: 'var(--accent)', background: 'transparent' }} />
          {query && (
            <button onClick={() => setQuery('')} className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>✕</button>
          )}
          <kbd className="hidden md:inline-block text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>Esc</kbd>
        </div>

        {/* Fil d'Ariane du dossier courant + dépôt à ce niveau. Masqué pendant
            une recherche, dont les résultats ne sont rattachés à aucun niveau. */}
        {!searching && (
          <div className="px-2 py-2 flex items-center gap-1 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto hide-scrollbar">
              <button onClick={() => setCurrentId(null)}
                className="u-hover-bg flex items-center gap-1 px-2 py-1 rounded-lg text-xs flex-shrink-0"
                style={{ color: currentId === null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <i className="ti ti-home" style={{ fontSize: '13px' }} />
                <span>Racine</span>
              </button>
              {path.map(crumb => (
                <span key={crumb.id} className="flex items-center gap-0.5 flex-shrink-0">
                  <span style={{ color: 'var(--text-faint)' }}>/</span>
                  <button onClick={() => setCurrentId(crumb.id)}
                    className="u-hover-bg px-2 py-1 rounded-lg text-xs max-w-[130px] truncate"
                    style={{ color: crumb.id === currentId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {crumb.title || 'Sans titre'}
                  </button>
                </span>
              ))}
            </div>
            <button onClick={() => onMove(currentId)} disabled={currentIsOrigin} title="Déplacer ici"
              className="u-hover-bg flex-shrink-0 flex items-center gap-1 px-2 rounded-lg text-xs disabled:opacity-40"
              style={{ height: 32, color: 'var(--accent)' }}>
              <i className="ti ti-corner-down-right" style={{ fontSize: '15px' }} />
              <span>Ici</span>
            </button>
          </div>
        )}

        <div ref={contentRef} className="overflow-y-auto overscroll-contain flex-1 py-1">
          {searching ? (
            results.length === 0
              ? <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune page trouvée</p>
              : results.map(p => <Row key={p.id} p={p} />)
          ) : children.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
              {currentId === null ? 'Aucune page à la racine' : 'Aucune sous-page ici'}
            </p>
          ) : (
            children.map(p => <Row key={p.id} p={p} />)
          )}
        </div>
      </div>
    </div>
  )
}
