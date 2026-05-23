'use client'
import { useState } from 'react'
import { Page } from '../types'

export function SearchBar({ pages, onSelect }: { pages: Page[], onSelect: (p: Page) => void }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const results = query.length > 1
    ? pages.filter(p =>
        (p.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (p.content || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  return (
    <div className="relative px-2 py-2 border-b border-gray-200">
      <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
        <span className="text-gray-400 text-sm">🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Rechercher..."
          className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-gray-400 w-6 h-6 flex items-center justify-center text-sm">✕</button>
        )}
      </div>
      {focused && results.length > 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-white border rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map(page => (
            <button key={page.id} onClick={() => { onSelect(page); setQuery('') }}
              className="w-full flex items-center gap-2 px-3 py-3 text-left hover:bg-gray-50 border-b last:border-0">
              <span>{page.icon || '📄'}</span>
              <p className="text-sm font-medium text-gray-800 truncate">{page.title || 'Sans titre'}</p>
            </button>
          ))}
        </div>
      )}
      {focused && query.length > 1 && results.length === 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-white border rounded-lg shadow-xl z-50 p-3">
          <p className="text-sm text-gray-400 text-center">Aucun résultat</p>
        </div>
      )}
    </div>
  )
}
