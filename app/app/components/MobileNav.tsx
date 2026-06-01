'use client'
import { useState } from 'react'
import { Page } from '../types'
import { FavoritesSection } from './PageTree'

// ─── MobileHomeView ───────────────────────────────────────────────────────────
export function MobileHomeView({ pages, selectedId, onSelect, onAdd, onShowTrash, trashedCount, onToggleFavorite, onShowJournal, journalCount }: {
  pages: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: () => void
  onShowTrash: () => void
  trashedCount: number
  onToggleFavorite: (id: string) => void
  onShowJournal: () => void
  journalCount: number
}) {
  const [search, setSearch] = useState('')

  function handleSelect(p: Page) {
    if (p.type === 'journal') onShowJournal()
    onSelect(p)
  }

  const nonJournalPages = pages.filter(p => p.type !== 'journal')
  const allFiltered = search
    ? pages.filter(p => !p.deleted_at && p.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.position - b.position)
    : nonJournalPages.filter(p => !p.deleted_at).sort((a, b) => a.position - b.position)

  const favorites = nonJournalPages.filter(p => p.favorite && !p.deleted_at)

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Idée</span>
        <button
          onClick={onShowTrash}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ color: 'var(--text-muted)' }}
        >
          🗑
          {trashedCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-400 text-white text-[9px] rounded-full flex items-center justify-center">
              {trashedCount}
            </span>
          )}
        </button>
      </div>

      {/* Liste scrollable */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {!search && favorites.length > 0 && (
          <>
            <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Favoris</p>
            {favorites.map(page => (
              <PageRow key={page.id} page={page} selectedId={selectedId} onSelect={handleSelect} onToggleFavorite={onToggleFavorite} />
            ))}
            <div className="mx-2 my-2" style={{ borderTop: '1px solid var(--border-light)' }} />
          </>
        )}

        {!search && (
          <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pages</p>
        )}

        {/* Journal */}
        {!search && (
          <div
            onClick={onShowJournal}
            className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors mobile-row-hover"
          >
            <span className="text-xl flex-shrink-0">📓</span>
            <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>Journal</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{journalCount > 0 ? journalCount : ''}</span>
          </div>
        )}

        {allFiltered.length === 0 && (
          <p className="text-sm px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Aucune page</p>
        )}

        {allFiltered.map(page => (
          <PageRow key={page.id} page={page} selectedId={selectedId} onSelect={handleSelect} onToggleFavorite={onToggleFavorite} />
        ))}
      </div>

      {/* Barre du bas : recherche + bouton nouveau */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-2"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          borderTop: '1px solid var(--border)',
          background: 'var(--app-bg)',
        }}
      >
        <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--selected-bg)' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
          )}
        </div>
        <button
          onClick={onAdd}
          className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
          title="Nouvelle page"
        >
          ✏️
        </button>
      </div>
    </div>
  )
}

// ─── PageRow ──────────────────────────────────────────────────────────────────
function PageRow({ page, selectedId, onSelect, onToggleFavorite }: {
  page: Page, selectedId: string | null,
  onSelect: (p: Page) => void,
  onToggleFavorite: (id: string) => void,
}) {
  return (
    <div
      onClick={() => onSelect(page)}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors mobile-row-hover ${selectedId === page.id ? 'mobile-row-selected' : ''}`}
    >
      <span className="text-xl flex-shrink-0">{page.icon || '📄'}</span>
      <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{page.title || 'Sans titre'}</span>
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(page.id) }}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
        style={{ color: page.favorite ? '#f59e0b' : 'var(--text-faint)' }}
      >
        {page.favorite ? '★' : '☆'}
      </button>
    </div>
  )
}

// ─── MobileTopBar ─────────────────────────────────────────────────────────────
export function MobileTopBar({ onBack, saving }: {
  onBack: () => void
  saving: boolean
}) {
  return (
    <div className="md:hidden flex items-center gap-2 px-4 pt-3 pb-1 flex-shrink-0">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Pages
      </button>
      <div className="flex-1" />
      <span className={`w-4 h-4 flex items-center justify-center transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      </span>
    </div>
  )
}

// ─── Kept for compatibility ───────────────────────────────────────────────────
export function MobileBottomNav(_: any) { return null }
export function MobilePageDrawer(_: any) { return null }
