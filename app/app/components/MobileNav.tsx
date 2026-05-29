'use client'
import { useState } from 'react'
import { Page } from '../types'
import { FavoritesSection } from './PageTree'

// ─── MobileHomeView ───────────────────────────────────────────────────────────
// Vue liste plein écran : favoris + toutes les pages + barre bas
export function MobileHomeView({ pages, selectedId, onSelect, onAdd, onShowTrash, trashedCount, onToggleFavorite }: {
  pages: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: () => void
  onShowTrash: () => void
  trashedCount: number
  onToggleFavorite: (id: string) => void
}) {
  const [search, setSearch] = useState('')

  const rootPages = pages
    .filter(p => !p.deleted_at)
    .filter(p => search
      ? p.title.toLowerCase().includes(search.toLowerCase())
      : true
    )
    .sort((a, b) => a.position - b.position)

  const favorites = pages.filter(p => p.favorite && !p.deleted_at)
  const allFiltered = search
    ? rootPages
    : pages.filter(p => !p.deleted_at).sort((a, b) => a.position - b.position)

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <span className="font-semibold text-gray-800 text-lg">Idée</span>
        <button
          onClick={onShowTrash}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"
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
            <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Favoris</p>
            {favorites.map(page => (
              <PageRow key={page.id} page={page} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
            ))}
            <div className="mx-2 my-2 border-t border-gray-100" />
          </>
        )}

        {!search && (
          <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pages</p>
        )}

        {allFiltered.length === 0 && (
          <p className="text-sm text-gray-400 px-2 py-4 text-center">Aucune page</p>
        )}

        {allFiltered.map(page => (
          <PageRow key={page.id} page={page} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
        ))}
      </div>

      {/* Barre du bas : recherche + bouton nouveau */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-t border-gray-100 bg-white"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
          <span className="text-gray-400 text-sm">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 text-xs">✕</button>
          )}
        </div>
        <button
          onClick={onAdd}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-900 text-white flex-shrink-0"
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
      className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors
        ${selectedId === page.id ? 'bg-gray-100' : 'hover:bg-gray-50 active:bg-gray-100'}`}
    >
      <span className="text-xl flex-shrink-0">{page.icon || '📄'}</span>
      <span className="flex-1 text-sm text-gray-800 truncate">{page.title || 'Sans titre'}</span>
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(page.id) }}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
        style={{ color: page.favorite ? '#f59e0b' : '#d1d5db' }}
      >
        {page.favorite ? '★' : '☆'}
      </button>
    </div>
  )
}

// ─── MobileTopBar ─────────────────────────────────────────────────────────────
// Barre du haut quand une page est ouverte sur mobile
export function MobileTopBar({ onBack, saving }: {
  onBack: () => void
  saving: boolean
}) {
  return (
    <div className="md:hidden flex items-center gap-2 px-4 pt-3 pb-1 flex-shrink-0">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
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

// ─── Kept for compatibility (desktop ne les utilise pas) ──────────────────────
export function MobileBottomNav(_: any) { return null }
export function MobilePageDrawer(_: any) { return null }
