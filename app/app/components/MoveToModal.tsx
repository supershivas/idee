'use client'
import { useState, useRef, useEffect } from 'react'
import { Page } from '../types'
import { normalizeStr, getDescendantIds } from '../utils'

// Modal « Déplacer vers… » : choisit un nouveau parent pour la page
// (la page elle-même et ses descendants sont exclus des candidats).
export function MoveToModal({ page, pages, onMove, onClose }: {
  page: Page
  pages: Page[]
  onMove: (parentId: string | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const excluded = new Set([page.id, ...getDescendantIds(pages, page.id)])
  const candidates = pages.filter(p => !p.deleted_at && p.type !== 'journal' && !excluded.has(p.id))
  const filtered = query.trim()
    ? candidates.filter(p => normalizeStr(p.title || '').includes(normalizeStr(query)))
    : candidates.slice(0, 12)

  function Row({ p }: { p: Page }) {
    return (
      <button onClick={() => onMove(p.id)}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <span className="flex-shrink-0">{p.icon || '📄'}</span>
        <span className="flex-1 truncate">{p.title || 'Sans titre'}</span>
        {p.parent_id && <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>sous-page</span>}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex flex-col rounded-2xl overflow-hidden"
        style={{ width: 400, maxHeight: '66vh', background: 'var(--card-bg)', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', border: '1px solid var(--border)' }}>
        <div className="px-4 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <i className="ti ti-folder-symlink" style={{ color: 'var(--text-muted)', fontSize: '15px' }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Déplacer vers…"
            className="flex-1 outline-none text-sm"
            style={{ color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', caretColor: 'var(--accent)', background: 'transparent' }} />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>Esc</kbd>
        </div>
        <div className="overflow-y-auto flex-1 pb-1">
          <button onClick={() => onMove(null)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left"
            style={{ color: 'var(--accent)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <i className="ti ti-home text-base flex-shrink-0" />
            <span>Aucun parent (page racine)</span>
          </button>
          <div style={{ height: '1px', background: 'var(--border)', margin: '2px 16px' }} />
          {filtered.length === 0
            ? <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Aucune page trouvée</p>
            : filtered.map(p => <Row key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  )
}
