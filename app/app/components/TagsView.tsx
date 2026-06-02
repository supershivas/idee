'use client'
import { useState, useRef, useEffect } from 'react'
import { Page } from '../types'

// Palette de couleurs pour les tags (bg, text, border)
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

// Assigne une couleur déterministe par nom de tag
function tagColor(tag: string) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_PALETTE[hash % TAG_PALETTE.length]
}

// ─── TagBadge ─────────────────────────────────────────────────────────────────
export function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const c = tagColor(tag)
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      #{tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-60 transition-opacity leading-none ml-0.5">×</button>
      )}
    </span>
  )
}

// ─── TagsInput ────────────────────────────────────────────────────────────────
export function TagsInput({ tags, onChange, allTags }: {
  tags: string[]
  onChange: (tags: string[]) => void
  allTags?: string[]
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
    onChange([...tags, tag])
    setInput('')
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
    <div className="relative px-6 pb-3">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
        {tags.map(tag => (
          <TagBadge key={tag} tag={tag} onRemove={() => onChange(tags.filter(t => t !== tag))} />
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // delay to allow suggestion click
            setTimeout(() => {
              if (input.trim()) addTag(input)
              setFocused(false)
            }, 150)
          }}
          onFocus={() => setFocused(true)}
          placeholder={tags.length === 0 ? '+ tag' : ''}
          className="text-xs outline-none bg-transparent min-w-0"
          style={{ color: 'var(--text-muted)', width: input ? `${input.length + 2}ch` : tags.length === 0 ? '5ch' : '3ch' }}
        />
      </div>

      {/* Dropdown suggestions */}
      {suggestions.length > 0 && (
        <div
          className="absolute left-6 top-full z-50 rounded-lg shadow-lg overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', minWidth: '140px' }}
        >
          {suggestions.slice(0, 8).map((s, i) => (
            <button
              key={s}
              onMouseDown={e => { e.preventDefault(); addTag(s) }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              style={{ background: i === highlightIdx ? 'var(--hover-bg)' : 'transparent' }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <TagBadge tag={s} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TagsView ─────────────────────────────────────────────────────────────────
export function TagsView({ pages, onSelect }: {
  pages: Page[]
  onSelect: (p: Page) => void
}) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const allTags = Array.from(
    new Set(pages.flatMap(p => p.tags || []))
  ).sort()

  const filtered = selectedTag
    ? pages.filter(p => (p.tags || []).includes(selectedTag) && !p.deleted_at)
    : []

  return (
    <div className="flex-1 overflow-y-auto py-4 px-3 md:px-6">
      <div className="page-card my-2 md:my-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-2xl">🏷️</span>
          <h1 className="page-title text-2xl">Tags</h1>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {allTags.length} tag{allTags.length !== 1 ? 's' : ''}
          </span>
        </div>

        {allTags.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <p className="text-3xl mb-2">🏷️</p>
            <p className="text-sm">Aucun tag pour l'instant.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Ajoute des tags sous le titre d'une page.</p>
          </div>
        )}

        {/* Liste des tags */}
        {allTags.length > 0 && (
          <div className="px-6 py-4 flex flex-wrap gap-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
            {allTags.map(tag => {
              const c = tagColor(tag)
              const isSelected = selectedTag === tag
              const count = pages.filter(p => (p.tags || []).includes(tag) && !p.deleted_at).length
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: isSelected ? c.text : c.bg,
                    color: isSelected ? '#fff' : c.text,
                    border: `1px solid ${c.border}`,
                    boxShadow: isSelected ? `0 0 0 2px ${c.border}` : 'none',
                  }}
                >
                  #{tag}
                  <span className="text-xs opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Pages du tag sélectionné */}
        {selectedTag && (
          <div>
            {filtered.length === 0 && (
              <p className="text-sm px-6 py-4" style={{ color: 'var(--text-muted)' }}>Aucune page avec ce tag.</p>
            )}
            {filtered.map(page => (
              <button key={page.id} onClick={() => onSelect(page)}
                className="w-full text-left flex items-center gap-3 px-6 py-3 transition-colors"
                style={{ borderBottom: '1px solid var(--border-light)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span className="text-lg flex-shrink-0">{page.icon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{page.title || 'Sans titre'}</p>
                  {(page.tags || []).length > 1 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(page.tags || []).filter(t => t !== selectedTag).map(t => (
                        <TagBadge key={t} tag={t} />
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }}>→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
