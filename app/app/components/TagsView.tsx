'use client'
import { useState } from 'react'
import { Page } from '../types'

// ─── TagBadge ─────────────────────────────────────────────────────────────────
export function TagBadge({ tag, onRemove }: { tag: string, onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: 'var(--selected-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
      #{tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-400 transition-colors leading-none">×</button>
      )}
    </span>
  )
}

// ─── TagsInput ────────────────────────────────────────────────────────────────
export function TagsInput({ tags, onChange }: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9\u00e0-\u00ff\-_]/g, '')
    if (!tag || tags.includes(tag)) { setInput(''); return }
    onChange([...tags, tag])
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-6 pb-3 min-h-[28px]">
      {tags.map(tag => (
        <TagBadge key={tag} tag={tag} onRemove={() => onChange(tags.filter(t => t !== tag))} />
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); setFocused(false) }}
        onFocus={() => setFocused(true)}
        placeholder={tags.length === 0 ? '+ tag' : ''}
        className="text-xs outline-none bg-transparent min-w-0"
        style={{ color: 'var(--text-muted)', width: input ? `${input.length + 2}ch` : undefined }}
      />
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
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{allTags.length} tag{allTags.length !== 1 ? 's' : ''}</span>
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
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: selectedTag === tag ? 'var(--btn-primary-bg)' : 'var(--selected-bg)',
                  color: selectedTag === tag ? 'var(--btn-primary-fg)' : 'var(--text-secondary)',
                }}
              >
                #{tag}
                <span className="text-xs ml-0.5" style={{ color: selectedTag === tag ? 'var(--btn-primary-fg)' : 'var(--text-muted)', opacity: 0.7 }}>
                  {pages.filter(p => (p.tags || []).includes(tag) && !p.deleted_at).length}
                </span>
              </button>
            ))}
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
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {(page.tags || []).filter(t => t !== selectedTag).map(t => (
                        <span key={t} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>#{t}</span>
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
