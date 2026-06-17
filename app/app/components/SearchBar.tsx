'use client'
import { useState, useRef, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react'
import { Page } from '../types'

export interface SearchBarHandle {
  focus: () => void
}

// Parse Tiptap JSON → texte brut (stack iterative, compatible ES5 target)
function tiptapToText(content: string): string {
  if (!content) return ''
  var doc: any = null
  try { doc = JSON.parse(content) } catch (_e) {
    return content.replace(/<[^>]+>/g, ' ')
  }
  var parts: string[] = []
  var stack: any[] = [doc]
  while (stack.length > 0) {
    var node = stack.pop()
    if (!node) continue
    if (node.type === 'text' && typeof node.text === 'string') {
      parts.push(node.text)
    }
    if (Array.isArray(node.content)) {
      for (var i = node.content.length - 1; i >= 0; i--) {
        stack.push(node.content[i])
      }
    }
  }
  return parts.join(' ')
}

function getSnippet(text: string, query: string): string | null {
  var lower = text.toLowerCase()
  var idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return null
  var start = Math.max(0, idx - 40)
  var end = Math.min(text.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  var idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export const SearchBar = forwardRef<SearchBarHandle, { pages: Page[], onSelect: (p: Page, query?: string) => void }>(
  function SearchBar({ pages, onSelect }, ref) {
    const [query, setQuery] = useState('')
    const [focused, setFocused] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { setSelectedIndex(-1) }, [query])

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus()
        inputRef.current?.select()
      },
    }))

    const pageTexts = useMemo(
      () => pages.map(function(p) { return { page: p, text: tiptapToText(p.content) } }),
      [pages]
    )

    const results = useMemo(function() {
      if (query.length < 2) return []
      var q = query.toLowerCase()
      return pageTexts
        .filter(function({ page, text }) {
          return (page.title || '').toLowerCase().includes(q) || text.toLowerCase().includes(q)
        })
        .map(function({ page, text }) {
          return { page: page, snippet: getSnippet(text, query) }
        })
        .slice(0, 8)
    }, [query, pageTexts])

    var isOpen = focused && query.length > 1

    return (
      <div className="relative px-2 py-2">
        <style>{`
          .search-highlight{background:var(--search-highlight,#fde68a);color:inherit;border-radius:2px;padding:0 1px}
          .sidebar-search-input::placeholder{color:var(--sidebar-muted)}
        `}</style>
        <div className="flex items-center gap-2 rounded-lg px-3" style={{ height: '36px', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <i className="ti ti-search" style={{ fontSize: '13px', color: 'var(--sidebar-icon)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, -1)) }
              else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
                e.preventDefault(); onSelect(results[selectedIndex].page, query); setQuery('')
              }
            }}
            placeholder="Rechercher…  ⌘/"
            className="sidebar-search-input flex-1 outline-none bg-transparent min-w-0"
            style={{ color: 'var(--sidebar-fg)', fontSize: '13px' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="w-6 h-6 flex items-center justify-center text-sm flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >✕</button>
          )}
        </div>
        {isOpen && (
          <div
            className="absolute left-2 right-2 top-full mt-1 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            {results.length === 0 ? (
              <p className="text-sm text-center py-3 px-3" style={{ color: 'var(--text-muted)' }}>Aucun résultat</p>
            ) : (
              <>
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {results.length} résultat{results.length > 1 ? 's' : ''}
                </p>
                {results.map(function({ page, snippet }, index) {
                  return (
                    <button
                      key={page.id}
                      onClick={() => { onSelect(page, query); setQuery('') }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
                      style={{ borderTop: '1px solid var(--border-light)', background: index === selectedIndex ? 'var(--hover-bg)' : 'transparent' }}
                    >
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
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    )
  }
)
