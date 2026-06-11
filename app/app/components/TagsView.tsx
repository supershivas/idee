'use client'
import { useState, useRef, useEffect } from 'react'
import { Page } from '../types'

const TAG_PALETTE: Array<{ bg: string; text: string; border: string }> = [
  { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  { bg: '#fef9c3', text: '#a16207', border: '#fef08a' },
  { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8' },
  { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
  { bg: '#cffafe', text: '#0e7490', border: '#a5f3fc' },
  { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
]

function tagColor(tag: string) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_PALETTE[hash % TAG_PALETTE.length]
}

export function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const c = tagColor(tag)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      #{tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-60 transition-opacity leading-none ml-0.5">×</button>
      )}
    </span>
  )
}

// ─── TagsInput ────────────────────────────────────────────────────────────────
export function TagsInput({ tags, onChange, allTags, compact }: {
  tags: string[]
  onChange: (tags: string[]) => void
  allTags?: string[]
  compact?: boolean
}) {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = focused && input.trim()
    ? (allTags || []).filter(t => t.startsWith(input.trim().toLowerCase()) && !tags.includes(t))
    : []

  useEffect(() => { setHighlightIdx(0) }, [input])

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9\u00e0-\u00ff\-_]/g, '')
    if (!tag || tags.includes(tag)) { setInput(''); return }
    onChange([...tags, tag]); setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); addTag(suggestions[highlightIdx]); return }
    }
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); return }
    if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1))
  }

  return (
    <div className={compact ? 'relative' : 'relative px-6 pb-3'}>
      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
        {tags.map(tag => (
          <TagBadge key={tag} tag={tag} onRemove={() => onChange(tags.filter(t => t !== tag))} />
        ))}
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { setTimeout(() => { if (input.trim()) addTag(input); setFocused(false) }, 150) }}
          onFocus={() => setFocused(true)}
          placeholder={tags.length === 0 ? '+ tag' : ''}
          className="text-xs outline-none bg-transparent min-w-0"
          style={{ color: 'var(--text-muted)', width: input ? `${input.length + 2}ch` : tags.length === 0 ? '5ch' : '3ch' }}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 rounded-lg shadow-lg overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', minWidth: '140px' }}>
          {suggestions.slice(0, 8).map((s, i) => (
            <button key={s} onMouseDown={e => { e.preventDefault(); addTag(s) }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              style={{ background: i === highlightIdx ? 'var(--hover-bg)' : 'transparent' }}
              onMouseEnter={() => setHighlightIdx(i)}>
              <TagBadge tag={s} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TagsView ─────────────────────────────────────────────────────────────────
export function TagsView({ pages, onSelect }: { pages: Page[]; onSelect: (p: Page) => void }) {
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  // Count per tag, sorted by frequency desc
  const tagCounts: Record<string, number> = {}
  pages.forEach(p => {
    if (p.deleted_at) return
    ;(p.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 })
  })
  const allTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a])

  const q = search.trim().toLowerCase()
  const visibleTags = q ? allTags.filter(t => t.includes(q)) : allTags

  const filteredPages = selectedTags.length > 0
    ? pages.filter(p => !p.deleted_at && selectedTags.every(t => (p.tags || []).includes(t)))
    : []

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  // max count for visual weight
  const maxCount = allTags.length > 0 ? Math.max(...allTags.map(t => tagCounts[t])) : 1

  return (
    <div className="flex-1 overflow-y-auto py-4 px-3 md:px-6">
      <div className="page-card my-2 md:my-4 overflow-hidden">

        {/* Header + search */}
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="page-title text-2xl">Tags</h1>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {allTags.length} tag{allTags.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14"
              viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
              style={{ color: 'var(--text-muted)' }}>
              <circle cx="6" cy="6" r="4" /><path d="M10 10l2.5 2.5" />
            </svg>
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un tag…"
              className="w-full text-sm rounded-xl pl-9 pr-8 py-2.5 outline-none"
              style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
            {search && (
              <button onClick={() => { setSearch(''); searchRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base transition-opacity hover:opacity-60"
                style={{ color: 'var(--text-muted)' }}>×</button>
            )}
          </div>
        </div>

        {/* Active filters */}
        {selectedTags.length > 0 && (
          <div className="px-6 py-3 flex flex-wrap gap-2 items-center" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Filtres :</span>
            {selectedTags.map(tag => {
              const c = tagColor(tag)
              return (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                  style={{ background: c.text, color: '#fff', border: `1px solid ${c.text}` }}>
                  #{tag} <span className="opacity-70">×</span>
                </button>
              )
            })}
            <button onClick={() => setSelectedTags([])}
              className="text-xs ml-auto transition-opacity hover:opacity-70 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}>
              Effacer tout
            </button>
          </div>
        )}

        {/* Empty state */}
        {allTags.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p className="text-4xl mb-3">🏷️</p>
            <p className="text-sm">Aucun tag pour l'instant.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Ajoute des tags sous le titre d'une page.</p>
          </div>
        )}

        {/* Tag cloud */}
        {allTags.length > 0 && (
          <div className="px-6 py-5 flex flex-wrap gap-2" style={{ borderBottom: selectedTags.length > 0 ? '1px solid var(--border)' : 'none' }}>
            {visibleTags.map(tag => {
              const c = tagColor(tag)
              const count = tagCounts[tag]
              const isSelected = selectedTags.includes(tag)
              // visual weight: opacity 0.6→1 based on relative frequency
              const weight = maxCount > 1 ? 0.6 + 0.4 * (count - 1) / (maxCount - 1) : 1
              return (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: isSelected ? c.text : c.bg,
                    color: isSelected ? '#fff' : c.text,
                    border: `1px solid ${isSelected ? c.text : c.border}`,
                    boxShadow: isSelected ? `0 0 0 2px ${c.border}` : 'none',
                    opacity: isSelected ? 1 : weight,
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  }}>
                  #{tag}
                  <span className="text-xs opacity-60">{count}</span>
                </button>
              )
            })}
            {visibleTags.length === 0 && (
              <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>
                Aucun tag correspondant à «&nbsp;{search}&nbsp;».
              </p>
            )}
          </div>
        )}

        {/* Pages list */}
        {selectedTags.length > 0 && filteredPages.length === 0 && (
          <p className="text-sm px-6 py-5" style={{ color: 'var(--text-muted)' }}>
            Aucune page avec {selectedTags.length > 1 ? 'ces tags combinés' : 'ce tag'}.
          </p>
        )}
        {filteredPages.map(page => (
          <button key={page.id} onClick={() => onSelect(page)}
            className="w-full text-left flex items-center gap-3 px-6 py-3 transition-colors"
            style={{ borderTop: '1px solid var(--border-light)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span className="text-lg flex-shrink-0">{page.icon || '📄'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{page.title || 'Sans titre'}</p>
              {(page.tags || []).length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {(page.tags || []).filter(t => !selectedTags.includes(t)).map(t => (
                    <TagBadge key={t} tag={t} />
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }}>→</span>
          </button>
        ))}

      </div>
    </div>
  )
}
