'use client'
import { useState, useRef } from 'react'
import { Page, formatSubtitle } from '../types'
import EmojiPicker from '../EmojiPicker'

const PAGE_SIZE = 10

// ─── JournalList ──────────────────────────────────────────────────────────────
export function JournalList({ entries, selectedId, onSelect, onAdd }: {
  entries: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: () => void
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const sorted = [...entries].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  const visible = sorted.slice(0, limit)
  const hasMore = sorted.length > limit

  return (
    <div className="flex-1 overflow-y-auto py-4 px-3 md:px-6">
      <div className="page-card my-2 md:my-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-2xl">📓</span>
          <h1 className="page-title text-2xl">Journal</h1>
          <span className="text-xs ml-auto mr-3" style={{ color: 'var(--text-muted)' }}>
            {sorted.length} entrée{sorted.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}
          >
            <span>✏️</span> Nouvelle entrée
          </button>
        </div>

        {/* Liste */}
        <div>
          {sorted.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm">Aucune entrée pour l'instant.</p>
            </div>
          )}
          {visible.map(entry => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className={`w-full text-left flex items-center gap-3 px-6 py-4 transition-colors journal-entry-row ${selectedId === entry.id ? 'journal-entry-selected' : ''}`}
              style={{ borderBottom: '1px solid var(--border-light)' }}
            >
              <span className="text-xl flex-shrink-0">{entry.icon || '📝'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {entry.title || 'Sans titre'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {formatSubtitle(entry.updated_at)}
                </p>
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }}>→</span>
            </button>
          ))}
        </div>

        {/* Charger plus */}
        {hasMore && (
          <div className="px-6 py-3" style={{ borderTop: '1px solid var(--border-light)' }}>
            <button
              onClick={() => setLimit(l => l + PAGE_SIZE)}
              className="w-full text-sm py-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Charger plus ({sorted.length - limit} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── JournalEntryHeader ───────────────────────────────────────────────────────
export function JournalEntryHeader({ entry, onBack, onTitleChange, onIconChange, onDateChange, saving, isMobile }: {
  entry: Page
  onBack: () => void
  onTitleChange: (v: string) => void
  onIconChange: (emoji: string) => void
  onDateChange?: (isoDate: string) => void
  saving: boolean
  isMobile?: boolean
}) {
  const [showIconPicker, setShowIconPicker] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const dateValue = entry.updated_at ? entry.updated_at.slice(0, 10) : ''

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value || !onDateChange) return
    const existing = new Date(entry.updated_at)
    const [y, m, d] = e.target.value.split('-').map(Number)
    existing.setFullYear(y, m - 1, d)
    onDateChange(existing.toISOString())
  }

  return (
    <div className="px-6 pt-4 pb-2 flex-shrink-0">
      {/* Lien retour journal */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs mb-3 transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Journal
      </button>

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
          {/* Date cliquable → date picker natif */}
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              title="Modifier la date"
            >
              {formatSubtitle(entry.updated_at)} ✎
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={dateValue}
              onChange={handleDateChange}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
        </div>
        <span className={`w-4 h-4 flex items-center justify-center mt-2 transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </span>
      </div>
    </div>
  )
}
