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
    <div className="flex-1 overflow-y-auto py-4 px-3 md:px-6">
      <div className="page-card my-2 md:my-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-2xl">📓</span>
          <h1 className="page-title text-2xl">Journal</h1>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{sorted.length} entrée{sorted.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Liste */}
        <div style={{ borderBottom: '1px solid var(--border-light)' }}>
          {sorted.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm">Aucune entrée pour l'instant.</p>
            </div>
          )}
          {sorted.map(entry => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className={`w-full text-left flex items-start gap-3 px-6 py-4 transition-colors journal-entry-row ${selectedId === entry.id ? 'journal-entry-selected' : ''}`}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{entry.icon || '📝'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{entry.title || 'Sans titre'}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatSubtitle(entry.updated_at)}</p>
                {entry.content && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {entry.content.replace(/[#*`>\-]/g, '').slice(0, 80)}
                  </p>
                )}
              </div>
              <span className="text-xs flex-shrink-0 mt-1" style={{ color: 'var(--text-faint)' }}>→</span>
            </button>
          ))}
        </div>

        {/* Bouton nouvelle entrée */}
        <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}
          >
            <span>✏️</span> Nouvelle entrée
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── JournalEntryHeader ───────────────────────────────────────────────────────
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
    <div className="px-6 pt-4 pb-2 flex-shrink-0">
      <div className="flex items-start gap-3">
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
            className="page-title w-full text-2xl md:text-3xl outline-none bg-transparent"
            style={{ caretColor: 'var(--text-primary)' }}
            value={entry.title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Sans titre"
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatSubtitle(entry.updated_at)}</p>
        </div>
        <span className={`w-4 h-4 flex items-center justify-center mt-2 transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </span>
      </div>
    </div>
  )
}
