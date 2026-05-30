'use client'
import { useState } from 'react'
import { Page, formatSubtitle } from '../types'
import EmojiPicker from '../EmojiPicker'

// ─── JournalList ──────────────────────────────────────────────────────────────
export function JournalList({ entries, selectedId, onSelect, onAdd }: {
  entries: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: () => void
}) {
  const sorted = [...entries].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📓</span>
          <h1 className="text-2xl font-bold text-gray-900">Journal</h1>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700 transition-colors"
        >
          <span>+</span> Nouvelle entrée
        </button>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        {sorted.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <p className="text-4xl mb-3">📓</p>
            <p className="text-sm">Aucune entrée pour l'instant.</p>
            <button onClick={onAdd} className="mt-3 text-sm text-blue-500 hover:underline">
              Créer la première
            </button>
          </div>
        )}
        <div className="space-y-1">
          {sorted.map(entry => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl transition-colors
                ${selectedId === entry.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{entry.icon || '📝'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {entry.title || 'Sans titre'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatSubtitle(entry.updated_at)}
                </p>
                {entry.content && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {entry.content.replace(/[#*`>\-]/g, '').slice(0, 80)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── JournalEntryHeader ───────────────────────────────────────────────────────
// Header d'une entrée journal ouverte (remplace le titre standard)
export function JournalEntryHeader({ entry, onBack, onTitleChange, onIconChange, saving, isMobile }: {
  entry: Page
  onBack: () => void
  onTitleChange: (v: string) => void
  onIconChange: (emoji: string) => void
  saving: boolean
  isMobile?: boolean
}) {
  const [showIconPicker, setShowIconPicker] = useState(false)

  return (
    <div className="px-4 md:px-8 pt-4 pb-2 flex-shrink-0">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-3"
      >
        ← Journal
      </button>
      <div className="flex items-start gap-3" style={{ maxWidth: '720px' }}>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowIconPicker(v => !v)}
            className="text-4xl hover:opacity-70 transition-opacity"
            style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {entry.icon || '📝'}
          </button>
          {showIconPicker && (
            <div className={isMobile ? 'fixed inset-x-4 top-20 z-50' : 'absolute top-full left-0 z-50'}>
              <EmojiPicker
                onSelect={emoji => { onIconChange(emoji); setShowIconPicker(false) }}
                onClose={() => setShowIconPicker(false)}
              />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <input
            className="w-full text-2xl md:text-3xl font-bold outline-none bg-transparent text-gray-900 placeholder-gray-300"
            value={entry.title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Sans titre"
          />
          <p className="text-xs text-gray-400 mt-1">{formatSubtitle(entry.updated_at)}</p>
        </div>
        <span className={`w-4 h-4 flex items-center justify-center mt-2 transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </span>
      </div>
    </div>
  )
}
