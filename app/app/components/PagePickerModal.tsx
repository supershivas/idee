'use client'
import { useState, useRef, useEffect } from 'react'
import { Page } from '../types'
import { normalizeStr } from '../utils'

// Palette de sélection de page (vue partagée / ⌘K) : favoris, récents,
// dernières entrées journal, avec recherche par titre.
export function PagePickerModal({ pages, onSelect, onClose, onCloseSplit, hideCloseSplit }: {
  pages: Page[]
  onSelect: (p: Page) => void
  onClose: () => void
  onCloseSplit: () => void
  hideCloseSplit?: boolean
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const allActive = pages.filter(p => !p.deleted_at)
  const nonJournal = allActive.filter(p => p.type !== 'journal')
  const journal = allActive.filter(p => p.type === 'journal')

  const favorites = nonJournal
    .filter(p => p.favorite)
    .sort((a, b) => (a.favorite_position ?? 999) - (b.favorite_position ?? 999))

  const recentPages = [...nonJournal]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 7)

  const recentJournal = [...journal]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const hasQuery = query.trim().length > 0
  const filtered = hasQuery
    ? allActive.filter(p => normalizeStr(p.title || '').includes(normalizeStr(query)))
    : []

  function PageRow({ p }: { p: Page }) {
    return (
      <button
        key={p.id}
        onClick={() => onSelect(p)}
        className="u-hover-bg w-full flex items-center gap-3 px-4 py-2 text-sm text-left"
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="flex-shrink-0">{p.icon || (p.type === 'journal' ? '📝' : '📄')}</span>
        <span className="flex-1 truncate">{p.title || 'Sans titre'}</span>
        {p.type === 'journal' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>Journal</span>
        )}
      </button>
    )
  }

  function SectionLabel({ label }: { label: string }) {
    return (
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{ width: 420, maxHeight: '72vh', background: 'var(--card-bg)', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', border: '1px solid var(--border)' }}
      >
        <div className="px-4 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <i className="ti ti-search" style={{ color: 'var(--text-muted)', fontSize: '15px' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une page…"
            className="flex-1 outline-none text-sm"
            style={{ color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', caretColor: 'var(--accent)', background: 'transparent' }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>Esc</kbd>
        </div>

        <div className="overflow-y-auto flex-1 pb-1">
          {hasQuery ? (
            filtered.length === 0
              ? <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Aucune page trouvée</p>
              : filtered.map(p => <PageRow key={p.id} p={p} />)
          ) : (
            <>
              {favorites.length > 0 && (
                <>
                  <SectionLabel label="Favoris" />
                  {favorites.map(p => <PageRow key={p.id} p={p} />)}
                </>
              )}
              {recentPages.length > 0 && (
                <>
                  <SectionLabel label="Récemment modifiés" />
                  {recentPages.map(p => <PageRow key={p.id} p={p} />)}
                </>
              )}
              {recentJournal.length > 0 && (
                <>
                  <SectionLabel label="Dernières entrées journal" />
                  {recentJournal.map(p => <PageRow key={p.id} p={p} />)}
                </>
              )}
            </>
          )}
        </div>

        {!hideCloseSplit && (
          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={onCloseSplit}
              className="u-hover-bg w-full text-sm py-2 rounded-lg"
              style={{ color: 'var(--text-muted)' }}
            >
              <i className="ti ti-layout-columns-off mr-2" />
              Fermer la vue partagée
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
