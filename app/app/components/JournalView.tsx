'use client'
import { useState, useRef } from 'react'
import { Page } from '../types'
import { createClient } from '@/lib/supabase/client'

const PAGE_SIZE_OPTIONS = [10, 15, 20]

export function JournalList({
  entries,
  selectedId,
  onSelect,
  onAdd,
}: {
  entries: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: () => void
}) {
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const sorted = [...entries].sort((a, b) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )

  const total = sorted.length
  const shown = sorted.slice(0, page * pageSize)
  const hasMore = shown.length < total

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 md:px-8 pt-6 pb-2">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
        >
          📓 Journal
        </h2>
        <div className="flex items-center gap-2">
          {/* Page size selector */}
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="text-xs rounded-md px-2 py-1 outline-none"
            style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}
          >
            <span>✏️</span>
            <span>Nouvelle entrée</span>
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="px-4 md:px-6 pb-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl mb-3">📝</p>
            <p className="text-base font-medium mb-1" style={{ color: 'var(--empty-title)' }}>Aucune entrée</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Commencez à écrire votre journal.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1 mt-2">
              {shown.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => onSelect(entry)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                  style={{
                    background: selectedId === entry.id ? 'var(--selected-bg)' : 'transparent',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={e => { if (selectedId !== entry.id) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = selectedId === entry.id ? 'var(--selected-bg)' : 'transparent' }}
                >
                  <span className="text-lg flex-shrink-0">{entry.icon || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{entry.title || 'Sans titre'}</p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {entry.created_at ? new Date(entry.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                </button>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--selected-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                >
                  Charger plus ({total - shown.length} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function JournalEntryHeader({
  entry,
  onBack,
  onTitleChange,
  onIconChange,
  saving,
  isMobile,
}: {
  entry: Page
  onBack: () => void
  onTitleChange: (t: string) => void
  onIconChange: (icon: string) => void
  saving: boolean
  isMobile: boolean
}) {
  const [editingDate, setEditingDate] = useState(false)
  // Parse date from title (format: "lundi 2 juin 2025" ou ISO)
  // We store the display title and allow editing via a date input
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Try to derive a date value for the input from the entry's created_at
  const isoDate = entry.created_at ? entry.created_at.slice(0, 10) : ''

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value // yyyy-mm-dd
    if (!val) return
    const d = new Date(val + 'T12:00:00')
    const newTitle = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    onTitleChange(newTitle)
    setEditingDate(false)
  }

  return (
    <div className="px-6 pt-3 pb-1">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm mb-3 transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>←</span>
        <span>Journal</span>
      </button>

      {/* Title row */}
      <div className="flex items-start gap-3">
        <span className="text-4xl flex-shrink-0" style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {entry.icon || '📝'}
        </span>
        <div className="flex-1 min-w-0">
          {/* Title = date — click to edit date */}
          <div className="flex items-center gap-2 group/date">
            <h1
              className="page-title text-2xl md:text-3xl font-bold cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
              onClick={() => { setEditingDate(true); setTimeout(() => dateInputRef.current?.focus(), 50) }}
              title="Cliquer pour changer la date"
            >
              {entry.title || 'Sans titre'}
            </h1>
            <button
              onClick={() => { setEditingDate(true); setTimeout(() => dateInputRef.current?.focus(), 50) }}
              className="opacity-0 group-hover/date:opacity-100 transition-opacity text-sm"
              style={{ color: 'var(--text-muted)' }}
              title="Changer la date"
            >✏️</button>
          </div>
          {editingDate && (
            <div className="mt-1">
              <input
                ref={dateInputRef}
                type="date"
                defaultValue={isoDate}
                onChange={handleDateChange}
                onBlur={() => setEditingDate(false)}
                className="text-sm rounded-md px-2 py-1 outline-none"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
        {saving && (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </span>
        )}
      </div>
    </div>
  )
}
