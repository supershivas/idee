'use client'
import { useState, useEffect, useRef } from 'react'
import { Page } from '../types'

const MOBILE_JOURNAL_PAGE = 30

function JournalRow({ entry, selectedId, onSelect, onToggleFavorite }: {
  entry: Page, selectedId: string | null,
  onSelect: (p: Page) => void, onToggleFavorite: (id: string) => void,
}) {
  return (
    <div
      onClick={() => onSelect(entry)}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors mobile-row-hover ${selectedId === entry.id ? 'mobile-row-selected' : ''}`}
    >
      <span className="text-xl flex-shrink-0">{entry.icon || '📝'}</span>
      <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{entry.title || 'Sans titre'}</span>
      {(entry.tags || []).length > 0 && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {(entry.tags || []).slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
              {tag}
            </span>
          ))}
          {(entry.tags || []).length > 2 && (
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>+{(entry.tags || []).length - 2}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MobileHomeView ───────────────────────────────────────────────────────────
export function MobileHomeView({ pages, selectedId, onSelect, onAdd, onShowTrash, trashedCount, onToggleFavorite, onShowJournal, journalCount, onAddJournalEntry }: {
  pages: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: () => void
  onShowTrash: () => void
  trashedCount: number
  onToggleFavorite: (id: string) => void
  onShowJournal: () => void
  journalCount: number
  onAddJournalEntry: () => void
}) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'pages' | 'journal'>('pages')
  const [journalLimit, setJournalLimit] = useState(MOBILE_JOURNAL_PAGE)
  const journalSentinelRef = useRef<HTMLDivElement>(null)

  const nonJournalPages = pages.filter(p => p.type !== 'journal' && !p.deleted_at)
  const journalEntries = pages.filter(p => p.type === 'journal' && !p.deleted_at)
  const favorites = nonJournalPages.filter(p => p.favorite)

  const filteredPages = search
    ? nonJournalPages.filter(p => p.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.position - b.position)
    : nonJournalPages.sort((a, b) => a.position - b.position)

  const filteredJournal = search
    ? journalEntries.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
    : journalEntries

  const sortedJournal = [...filteredJournal].sort(
    (a, b) => new Date(b.updated_at || b.created_at || '').getTime() - new Date(a.updated_at || a.created_at || '').getTime()
  )
  const visibleJournal = sortedJournal.slice(0, journalLimit)
  const journalHasMore = sortedJournal.length > journalLimit

  useEffect(() => {
    if (!journalSentinelRef.current || !journalHasMore) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setJournalLimit(l => l + MOBILE_JOURNAL_PAGE)
    }, { threshold: 0.1 })
    obs.observe(journalSentinelRef.current)
    return () => obs.disconnect()
  }, [journalHasMore])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <img src="/apple-touch-icon.png" alt="Idée" className="w-7 h-7 rounded-xl flex-shrink-0" />
          <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Idée</span>
        </div>
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

      {/* Onglets Pages / Journal */}
      <div className="flex px-3 gap-1 pb-2 flex-shrink-0">
        <button
          onClick={() => setTab('pages')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{
            background: tab === 'pages' ? 'var(--selected-bg)' : 'transparent',
            color: tab === 'pages' ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          <span>📄</span>
          <span>Pages</span>
        </button>
        <button
          onClick={() => setTab('journal')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{
            background: tab === 'journal' ? 'var(--selected-bg)' : 'transparent',
            color: tab === 'journal' ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          <span>📓</span>
          <span>Journal</span>
          {journalCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
              {journalCount}
            </span>
          )}
        </button>
      </div>

      {/* Liste scrollable */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {tab === 'pages' ? (
          <>
            {!search && favorites.length > 0 && (
              <>
                <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Favoris</p>
                {favorites.map(page => (
                  <PageRow key={page.id} page={page} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
                ))}
                <div className="mx-2 my-2" style={{ borderTop: '1px solid var(--border-light)' }} />
              </>
            )}
            {filteredPages.length === 0 && (
              <p className="text-sm px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Aucune page</p>
            )}
            {filteredPages.map(page => (
              <PageRow key={page.id} page={page} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
            ))}
          </>
        ) : (
          <>
            {sortedJournal.length === 0 && (
              <p className="text-sm px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                {search ? 'Aucun résultat' : 'Aucune entrée. Crée la première !'}
              </p>
            )}
            {visibleJournal.map(entry => (
              <JournalRow key={entry.id} entry={entry} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
            ))}
            {journalHasMore && <div ref={journalSentinelRef} className="h-8" />}
          </>
        )}
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
          onClick={tab === 'journal' ? onAddJournalEntry : onAdd}
          className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
          title={tab === 'journal' ? 'Nouvelle entrée' : 'Nouvelle page'}
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

export function MobileBottomNav(_: any) { return null }
export function MobilePageDrawer(_: any) { return null }
