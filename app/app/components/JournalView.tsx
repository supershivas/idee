'use client'
import { useState, useRef, useEffect } from 'react'
import { Page, formatSubtitle } from '../types'
import EmojiPicker from '../EmojiPicker'
import { TagBadge } from './TagsView'

const PAGE_SIZE = 30

function useRelativeTime(iso: string | null | undefined) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!iso) { setLabel(''); return }
    function compute() {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
      if (diff < 60) setLabel('à l\'instant')
      else if (diff < 3600) setLabel(`il y a ${Math.floor(diff / 60)} min`)
      else if (diff < 86400) setLabel(`il y a ${Math.floor(diff / 3600)} h`)
      else setLabel(formatSubtitle(iso))
    }
    compute()
    const id = setInterval(compute, 60_000)
    return () => clearInterval(id)
  }, [iso])

  return label
}

// ─── JournalList ──────────────────────────────────────────────────────────────
export function JournalList({ entries, selectedId, onSelect, onAdd }: {
  entries: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: () => void
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const sorted = [...entries].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const visible = sorted.slice(0, limit)
  const hasMore = sorted.length > limit

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setLimit(l => l + PAGE_SIZE)
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [hasMore])

  return (
    <div className="flex-1 overflow-y-auto py-4 px-3 md:px-6">
      <div className="page-card my-2 md:my-4 overflow-hidden">
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

        <div>
          {sorted.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm">Aucune entrée pour l'instant.</p>
            </div>
          )}
          {visible.map(entry => (
            <JournalRow key={entry.id} entry={entry} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>

        {hasMore && <div ref={sentinelRef} className="h-8" />}
      </div>
    </div>
  )
}

function JournalRow({ entry, selectedId, onSelect }: { entry: Page; selectedId: string | null; onSelect: (p: Page) => void }) {
  const relativeModified = useRelativeTime(
    entry.updated_at !== entry.created_at ? entry.updated_at : null
  )

  return (
    <button
      onClick={() => onSelect(entry)}
      className={`w-full text-left flex items-center gap-3 px-6 py-4 transition-colors journal-entry-row ${selectedId === entry.id ? 'journal-entry-selected' : ''}`}
      style={{ borderBottom: '1px solid var(--border-light)' }}
    >
      <span className="text-xl flex-shrink-0">{entry.icon || '📝'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {entry.title || 'Sans titre'}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatSubtitle(entry.created_at)}
          </span>
          {relativeModified && (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>· Modifié {relativeModified}</span>
          )}
        </div>
      </div>
      {(entry.tags || []).length > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end max-w-[120px]">
          {(entry.tags || []).slice(0, 3).map(tag => (
            <TagBadge key={tag} tag={tag} />
          ))}
          {(entry.tags || []).length > 3 && (
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>+{(entry.tags || []).length - 3}</span>
          )}
        </div>
      )}
      <span className="text-xs flex-shrink-0 ml-1" style={{ color: 'var(--text-faint)' }}>→</span>
    </button>
  )
}

// ─── JournalEntryHeader ───────────────────────────────────────────────────────
export function JournalEntryHeader({ entry, onBack, onTitleChange, onIconChange, onCreatedAtChange, onDateChange, saving, isMobile }: {
  entry: Page
  onBack: () => void
  onTitleChange: (v: string) => void
  onIconChange: (emoji: string) => void
  onCreatedAtChange?: (isoDate: string) => void
  onDateChange?: (isoDate: string) => void
  saving: boolean
  isMobile?: boolean
}) {
  const [showIconPicker, setShowIconPicker] = useState(false)
  const createdInputRef = useRef<HTMLInputElement>(null)
  const relativeModified = useRelativeTime(
    entry.updated_at !== entry.created_at ? entry.updated_at : null
  )

  function makeDateValue(iso: string) {
    return iso ? iso.slice(0, 10) : ''
  }

  function handleCreatedChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value || !onCreatedAtChange) return
    const existing = new Date(entry.created_at)
    const [y, m, d] = e.target.value.split('-').map(Number)
    existing.setFullYear(y, m - 1, d)
    onCreatedAtChange(existing.toISOString())
  }

  return (
    <div className="px-6 pt-4 pb-2 flex-shrink-0">
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
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <button
              onClick={() => createdInputRef.current?.showPicker?.() ?? createdInputRef.current?.click()}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              title="Modifier la date de création"
            >
              {formatSubtitle(entry.created_at)} ✎
            </button>
            <input ref={createdInputRef} type="date" value={makeDateValue(entry.created_at)}
              onChange={handleCreatedChange} className="sr-only" tabIndex={-1} />
            {relativeModified && (
              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>· Modifié {relativeModified}</span>
            )}
          </div>
        </div>
        <span className={`w-4 h-4 flex items-center justify-center mt-2 transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </span>
      </div>
    </div>
  )
}
