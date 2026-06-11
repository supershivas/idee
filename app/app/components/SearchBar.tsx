'use client'
import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { Page } from '../types'

export interface SearchBarHandle {
  focus: () => void
}

export const SearchBar = forwardRef<SearchBarHandle, { pages: Page[], onSelect: (p: Page) => void }>(
  function SearchBar({ pages, onSelect }, ref) {
    const [query, setQuery] = useState('')
    const [focused, setFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => { inputRef.current?.focus(); inputRef.current?.select() },
    }))

    const results = query.length > 1
      ? pages.filter(p =>
          (p.title || '').toLowerCase().includes(query.toLowerCase()) ||
          (p.content || '').toLowerCase().includes(query.toLowerCase())
        ).slice(0, 8)
      : []

    return (
      <div className="relative px-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
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
        {focused && results.length > 0 && (
          <div className="absolute left-2 right-2 top-full mt-1 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            {results.map(page => (
              <button key={page.id} onClick={() => { onSelect(page); setQuery('') }}
                className="w-full flex items-center gap-2 px-3 py-3 text-left transition-colors"
                style={{ borderBottom: '1px solid var(--border-light)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span className="flex-shrink-0">{page.icon || '📄'}</span>
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{page.title || 'Sans titre'}</p>
              </button>
            ))}
          </div>
        )}
        {focused && query.length > 1 && results.length === 0 && (
          <div className="absolute left-2 right-2 top-full mt-1 rounded-lg shadow-xl z-50 p-3"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>Aucun résultat</p>
          </div>
        )}
      </div>
    )
  }
)
