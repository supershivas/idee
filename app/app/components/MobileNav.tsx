'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Page } from '../types'

const MOBILE_JOURNAL_PAGE = 30

// ── Tiptap JSON → plain text ──────────────────────────────────────────────────
function tiptapToText(content: any): string {
  if (!content) return ''
  try {
    const doc = typeof content === 'string' ? JSON.parse(content) : content
    const parts: string[] = []
    function walk(node: any) {
      if (!node) return
      if (node.type === 'text' && node.text) parts.push(node.text)
      if (Array.isArray(node.content)) node.content.forEach(walk)
    }
    walk(doc)
    return parts.join(' ')
  } catch {
    if (typeof content === 'string') return content.replace(/<[^>]+>/g, ' ')
    return ''
  }
}

// ── Snippet autour du match ───────────────────────────────────────────────────
function getSnippet(text: string, query: string): string | null {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - 35)
  const end = Math.min(text.length, idx + query.length + 70)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

// ── Highlight ─────────────────────────────────────────────────────────────────
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--search-highlight, #fde68a)', color: 'inherit', borderRadius: '2px', padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Search overlay plein écran ────────────────────────────────────────────────
function MobileSearchOverlay({
  pages,
  onSelect,
  onClose,
}: {
  pages: Page[]
  onSelect: (p: Page) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  // Lock body scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const pageTexts = useMemo(() =>
    pages.map(p => ({ page: p, text: tiptapToText(p.content) })),
    [pages]
  )

  const results = useMemo(() => {
    if (query.length < 2) return []
    const q = query.toLowerCase()
    return pageTexts
      .filter(({ page, text }) =>
        (page.title || '').toLowerCase().includes(q) || text.toLowerCase().includes(q)
      )
      .map(({ page, text }) => {
        const titleMatch = (page.title || '').toLowerCase().includes(query.toLowerCase())
        const snippet = getSnippet(text, query)
        return { page, snippet: titleMatch && !text.toLowerCase().includes(query.toLowerCase()) ? null : snippet }
      })
      .slice(0, 20)
  }, [query, pageTexts])

  const noteResults = results.filter(r => r.page.type !== 'journal')
  const journalResults = results.filter(r => r.page.type === 'journal')

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--app-bg)' }}
    >
      {/* Input bar */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'var(--selected-bg)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher dans toutes les pages…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="w-5 h-5 flex items-center justify-center rounded text-xs flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >✕</button>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-sm font-medium px-1 py-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          Annuler
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {query.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">🔍</span>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tape pour rechercher dans tes pages</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">🌫️</span>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun résultat pour «&nbsp;{query}&nbsp;»</p>
          </div>
        ) : (
          <div className="px-3 py-2">
            {noteResults.length > 0 && (
              <>
                <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Pages · {noteResults.length}
                </p>
                {noteResults.map(({ page, snippet }) => (
                  <SearchResultRow
                    key={page.id}
                    page={page}
                    snippet={snippet}
                    query={query}
                    onSelect={() => { onSelect(page); onClose() }}
                  />
                ))}
              </>
            )}
            {journalResults.length > 0 && (
              <>
                <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Journal · {journalResults.length}
                </p>
                {journalResults.map(({ page, snippet }) => (
                  <SearchResultRow
                    key={page.id}
                    page={page}
                    snippet={snippet}
                    query={query}
                    onSelect={() => { onSelect(page); onClose() }}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SearchResultRow({ page, snippet, query, onSelect }: {
  page: Page
  snippet: string | null
  query: string
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className="flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors active:opacity-70"
      style={{ borderBottom: '1px solid var(--border-light)' }}
    >
      <span className="text-xl flex-shrink-0 mt-0.5">{page.icon || '📄'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          <Highlighted text={page.title || 'Sans titre'} query={query} />
        </p>
        {snippet && (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            <Highlighted text={snippet} query={query} />
          </p>
        )}
      </div>
    </div>
  )
}

// ─── JournalRow ───────────────────────────────────────────────────────────────
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
  const [showSearch, setShowSearch] = useState(false)
  const [tab, setTab] = useState<'pages' | 'journal'>('pages')
  const [journalLimit, setJournalLimit] = useState(MOBILE_JOURNAL_PAGE)
  const journalSentinelRef = useRef<HTMLDivElement>(null)

  const nonJournalPages = pages.filter(p => p.type !== 'journal' && !p.deleted_at)
  const journalEntries = pages.filter(p => p.type === 'journal' && !p.deleted_at)
  const favorites = nonJournalPages.filter(p => p.favorite)

  const sortedPages = [...nonJournalPages].sort((a, b) => a.position - b.position)
  const sortedJournal = [...journalEntries].sort(
    (a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
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
      {/* Search overlay */}
      {showSearch && (
        <MobileSearchOverlay
          pages={pages}
          onSelect={p => { onSelect(p) }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <img src="/apple-touch-icon.png" alt="Idée" className="w-7 h-7 rounded-xl flex-shrink-0" />
          <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Idée</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Bouton recherche */}
          <button
            onClick={() => setShowSearch(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
            style={{ color: 'var(--text-muted)', background: 'var(--selected-bg)' }}
            title="Rechercher"
          >
            🔍
          </button>
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
            {favorites.length > 0 && (
              <>
                <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Favoris</p>
                {favorites.map(page => (
                  <PageRow key={page.id} page={page} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
                ))}
                <div className="mx-2 my-2" style={{ borderTop: '1px solid var(--border-light)' }} />
              </>
            )}
            {sortedPages.length === 0 && (
              <p className="text-sm px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Aucune page</p>
            )}
            {sortedPages.map(page => (
              <PageRow key={page.id} page={page} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
            ))}
          </>
        ) : (
          <>
            {sortedJournal.length === 0 && (
              <p className="text-sm px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                Aucune entrée. Crée la première !
              </p>
            )}
            {visibleJournal.map(entry => (
              <JournalRow key={entry.id} entry={entry} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
            ))}
            {journalHasMore && <div ref={journalSentinelRef} className="h-8" />}
          </>
        )}
      </div>

      {/* Barre du bas : bouton nouveau */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-2"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          borderTop: '1px solid var(--border)',
          background: 'var(--app-bg)',
        }}
      >
        <button
          onClick={tab === 'journal' ? onAddJournalEntry : onAdd}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
        >
          <span>{tab === 'journal' ? '✏️' : '+'}</span>
          <span>{tab === 'journal' ? 'Nouvelle entrée' : 'Nouvelle page'}</span>
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
