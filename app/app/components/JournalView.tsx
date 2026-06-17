'use client'
import { useState, useRef, useEffect } from 'react'
import { Page, formatSubtitle } from '../types'
import { TagBadge } from './TagsView'

const PAGE_SIZE = 30

export function useRelativeTime(iso: string | null | undefined) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!iso) { setLabel(''); return }
    function compute() {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
      if (diff < 60) setLabel("à l'instant")
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

// ─── PageMetadata ─────────────────────────────────────────────────────────────
export function PageMetadata({ page, inline }: { page: Page; inline?: boolean }) {
  const relativeModified = useRelativeTime(
    page.updated_at && page.updated_at !== page.created_at ? page.updated_at : null
  )
  if (!relativeModified) return null
  if (inline) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
        · Modifié {relativeModified}
      </span>
    )
  }
  return (
    <div className="flex items-center gap-2 px-6 pb-2 flex-wrap">
      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Modifié {relativeModified}
      </span>
    </div>
  )
}

// ─── JournalList ──────────────────────────────────────────────────────────────
export function JournalList({ entries, selectedId, onSelect, onAdd, onDelete, onDuplicate }: {
  entries: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: () => void
  onDelete?: (ids: string[]) => void
  onDuplicate?: (ids: string[]) => void
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function exitSelecting() {
    setSelecting(false)
    setSelectedIds(new Set())
  }

  function exportSelected() {
    const items = sorted.filter(e => selectedIds.has(e.id))
    const text = items.map(e => {
      const date = new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      return `# ${e.title || 'Sans titre'}\n_${date}_\n\n${e.content.replace(/<[^>]+>/g, '').trim()}`
    }).join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
    exitSelecting()
  }

  return (
    <div className="flex-1 overflow-y-auto py-4 px-3 md:px-6">
      <div className="page-card my-2 md:my-4" style={{ overflow: "visible" }}>
        {/* Header */}
        <div className="px-4 md:px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">📓</span>
            <h1 className="page-title text-2xl flex-1 min-w-0 truncate">Journal</h1>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              {sorted.length} entrée{sorted.length !== 1 ? 's' : ''}
            </span>
            {/* Three-dot menu */}
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="Actions"
              >
                <i className="ti ti-dots" style={{ fontSize: '16px' }} />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-9 z-50 rounded-xl shadow-xl py-1 min-w-[160px]"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
                >
                  <button
                    onClick={() => { setSelecting(true); setMenuOpen(false) }}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <i className="ti ti-checkbox" style={{ fontSize: '15px', color: 'var(--text-muted)' }} />
                    Sélectionner
                  </button>
                </div>
              )}
            </div>
          </div>
          {!selecting && (
            <>
              <button
                onClick={onAdd}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors md:hidden"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
              >
                <span>✏️</span><span>Nouvelle entrée</span>
              </button>
              <button
                onClick={onAdd}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors mt-3 flex-shrink-0"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}
              >
                <span>✏️</span><span>Nouvelle entrée</span>
              </button>
            </>
          )}
          {/* Bulk action bar */}
          {selecting && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
                {selectedIds.size} sélectionné{selectedIds.size !== 1 ? 's' : ''}
              </span>
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={() => {
                      if (onDuplicate) onDuplicate([...selectedIds])
                      exitSelecting()
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--selected-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  >
                    <i className="ti ti-copy" style={{ fontSize: '13px' }} /> Dupliquer
                  </button>
                  <button
                    onClick={exportSelected}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--selected-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  >
                    <i className="ti ti-clipboard-copy" style={{ fontSize: '13px' }} /> Exporter
                  </button>
                  <button
                    onClick={() => {
                      if (onDelete) onDelete([...selectedIds])
                      exitSelecting()
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'rgba(192,57,43,0.08)', color: '#C0392B' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,57,43,0.14)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(192,57,43,0.08)')}
                  >
                    <i className="ti ti-trash" style={{ fontSize: '13px' }} /> Supprimer
                  </button>
                </>
              )}
              <button
                onClick={exitSelecting}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        <div>
          {sorted.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm">Aucune entrée pour l'instant.</p>
            </div>
          )}
          {visible.map(entry => (
            <JournalRow
              key={entry.id}
              entry={entry}
              selectedId={selectedId}
              onSelect={onSelect}
              selecting={selecting}
              checked={selectedIds.has(entry.id)}
              onToggle={() => toggleId(entry.id)}
            />
          ))}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-8" />}
      </div>
    </div>
  )
}

function JournalRow({ entry, selectedId, onSelect, selecting, checked, onToggle }: {
  entry: Page
  selectedId: string | null
  onSelect: (p: Page) => void
  selecting?: boolean
  checked?: boolean
  onToggle?: () => void
}) {
  const relativeModified = useRelativeTime(
    entry.updated_at !== entry.created_at ? entry.updated_at : null
  )
  return (
    <button
      onClick={() => selecting ? onToggle?.() : onSelect(entry)}
      className={`w-full text-left flex items-start gap-3 px-4 md:px-6 py-3 transition-colors journal-entry-row ${selectedId === entry.id ? 'journal-entry-selected' : ''}`}
      style={{ borderBottom: '1px solid var(--border-light)', background: checked ? 'var(--selected-bg-60)' : undefined }}
    >
      {selecting ? (
        <span className="flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded border-2 transition-colors"
          style={{ borderColor: checked ? 'var(--accent)' : 'var(--border)', background: checked ? 'var(--accent)' : 'transparent' }}>
          {checked && <i className="ti ti-check text-white" style={{ fontSize: '11px' }} />}
        </span>
      ) : (
        <span className="text-xl flex-shrink-0 mt-0.5">{entry.icon || '📝'}</span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium md:truncate" style={{ color: 'var(--text-primary)', overflowWrap: 'break-word', wordBreak: 'break-word', whiteSpace: 'normal' }}>
          {entry.title || 'Sans titre'}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatSubtitle(entry.created_at)}</span>
          {relativeModified && (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>· Modifié {relativeModified}</span>
          )}
        </div>
        {/* Tags sous le titre sur mobile */}
        {(entry.tags || []).length > 0 && (
          <div className="flex md:hidden items-center gap-1 mt-1 flex-wrap">
            {(entry.tags || []).slice(0, 2).map(tag => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {(entry.tags || []).length > 2 && (
              <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>+{(entry.tags || []).length - 2}</span>
            )}
          </div>
        )}
      </div>
      {/* Tags à droite sur desktop uniquement */}
      {(entry.tags || []).length > 0 && (
        <div className="hidden md:flex items-center gap-1 flex-shrink-0 flex-wrap justify-end max-w-[140px]">
          {(entry.tags || []).slice(0, 3).map(tag => (
            <TagBadge key={tag} tag={tag} />
          ))}
          {(entry.tags || []).length > 3 && (
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>+{(entry.tags || []).length - 3}</span>
          )}
        </div>
      )}
      {!selecting && <span className="hidden md:inline text-xs flex-shrink-0 mt-0.5" style={{ color: 'var(--text-faint)' }}>→</span>}
    </button>
  )
}
