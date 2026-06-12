'use client'
import { useState, useRef, forwardRef, useImperativeHandle, useMemo } from 'react'
import { Page } from '../types'

export interface SearchBarHandle {
  focus: () => void
}

// Parse Tiptap JSON récursivement → texte brut
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

// Extrait ~120 chars autour du premier match
function getSnippet(text: string, query: string): string | null {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

// Highlight du terme cherché
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export const SearchBar = forwardRef<SearchBarHandle, { pages: Page[], onSelect: (p: Page) => void }>(
  function SearchBar({ pages, onSelect }, ref) {
    const [query, setQuery] = useState('')
    const [focused, setFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => { inputRef.current?.focus(); inputRef.current?.select() },
    }))

    const pageTexts = useMemo(() =>
      pages.map(p => ({ page: p, text: tiptapToText(p.content) })),
      [pages]
    )

    const results = useMemo(() => {
      if (query.length < 2) return []
      const q = query.toLowerCase()
      return pageTexts
        .filter(({ page, text }) =>
          (page.title || '').toLowerCase().includes(q) ||
          text.toLowerCase().includes(q)
        )
        .map(({ page, text }) => {
          const snippet = getSnippet(text, query)
          return { page, snippet }
        })
        .slice(0, 8)
    }, [query, pageTexts])

    const isOpen = focused && query.length > 1

    return (
      <div className="relative px-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <style>{`.search-highlight { background: var(--search-highlight, #fde68a); color: inherit; border-radius: 2px; padding: 0 1px; }`}</style>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--selected-bg)' }}>
          <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Rechercher…  ⌘K"
            className="flex-1 text-sm outline-none bg-transparent min-w-0"
            style={{ color: 'var(--text-primary)' }}
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="w-6 h-6 flex items-center justify-center text-sm flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}>✕</button>
          )}
        </div>
        {isOpen && results.length > 0 && (
          <div className="absolute left-2 right-2 top-full mt-1 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {results.length} résultat{results.length > 1 ? 's' : ''}
            </p>
            {results.map(({ page, snippet }) => (
              <button key={page.id} onClick={() => { onSelect(page); setQuery('') }}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
                style={{ borderTop: '1px solid var(--border-light)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span className="flex-shrink-0 text-base mt-0.5">{page.icon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    <Highlighted text={page.title || 'Sans titre'} query={query} />
                  </p>
                  {snippet && (
                    <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      <Highlighted text={snippet} query={query} />
                    </p>
                  )}
                  {page.type === 'journal' && (
                    <span className="inline-block text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--hover-bg)', color: 'var(--text-faint)' }}>
                      Journal
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        {isOpen && results.length === 0 && (
          <div className="absolute left-2 right-2 top-full mt-1 rounded-lg shadow-xl z-50 p-3"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>Aucun résultat</p>
          </div>
        )}
      </div>
    )
  }
)
