'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Page } from './types'
import { normalizeStr } from './utils'
import { looksLikeUrl, toHref, hostOf } from './linkUtils'

export type LinkChoice = { kind: 'page'; page: Page } | { kind: 'url'; href: string }

// Un seul champ pour les deux sortes de liens. On ne demande pas à
// l'utilisateur de déclarer ce qu'il s'apprête à saisir : ce qui ressemble à
// une adresse fait apparaître une ligne « lien externe » en tête de liste,
// tout le reste cherche parmi ses pages. Lier vers une de ses propres pages
// est le cas le plus fréquent, et c'était précisément celui qui manquait —
// le bouton n'offrait qu'un champ `https://`.
export function LinkPicker({ pages, initialQuery = '', onPick, onClose }: {
  pages: Page[]
  initialQuery?: string
  onPick: (choice: LinkChoice) => void
  onClose: () => void
}) {
  const [q, setQ] = useState(initialQuery)
  const [idx, setIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const isUrl = looksLikeUrl(q)
  const results = useMemo(() => {
    const n = normalizeStr(q.trim())
    const candidates = pages.filter(p => !p.deleted_at)
    if (!n) return candidates.slice(0, 6)
    return candidates.filter(p => normalizeStr(p.title || '').includes(n)).slice(0, 6)
  }, [pages, q])

  // La ligne « lien externe » passe en tête : quand on tape une adresse, c'est
  // elle qu'on veut, et elle doit se trouver sous la touche Entrée.
  const rows: LinkChoice[] = useMemo(() => [
    ...(isUrl ? [{ kind: 'url' as const, href: toHref(q) }] : []),
    ...results.map(p => ({ kind: 'page' as const, page: p })),
  ], [isUrl, q, results])

  useEffect(() => setIdx(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  // Le parent départage deux pages de même titre. Sans lui, choisir entre deux
  // « Notes de lecture » revient à tirer au sort.
  const parentOf = (p: Page) => pages.find(x => x.id === p.parent_id)?.title

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center" onMouseDown={onClose}>
      <div className="rounded-t-2xl md:rounded-2xl shadow-xl w-full md:w-[400px] overflow-hidden"
        style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}
        onMouseDown={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 md:hidden" style={{ background: 'var(--border)' }} />

        <div className="p-4 pb-2">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, rows.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); if (rows[idx]) onPick(rows[idx]) }
              else if (e.key === 'Escape') { e.preventDefault(); onClose() }
            }}
            placeholder="Chercher une page, ou coller une adresse…"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ border: '1px solid var(--border)', background: 'var(--app-bg)', color: 'var(--text-primary)' }} />
        </div>

        <div ref={listRef} className="px-2 pb-2 overflow-y-auto" style={{ maxHeight: 264 }}>
          {rows.length === 0 && (
            <p className="text-xs px-3 py-4" style={{ color: 'var(--text-muted)' }}>
              Aucune page à ce nom. Pour un lien externe, saisis une adresse complète.
            </p>
          )}
          {rows.map((r, i) => (
            <button key={r.kind === 'url' ? 'url' : r.page.id}
              data-active={i === idx}
              onMouseEnter={() => setIdx(i)}
              onMouseDown={e => { e.preventDefault(); onPick(r) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg"
              style={{ background: i === idx ? 'var(--hover-bg)' : 'transparent' }}>
              {r.kind === 'url' ? (
                <>
                  <i className="ti ti-external-link flex-shrink-0" style={{ fontSize: 15, color: 'var(--text-muted)' }} />
                  <span className="flex-1 min-w-0 text-sm truncate">{hostOf(q)}</span>
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>lien externe</span>
                </>
              ) : (
                <>
                  <span className="flex-shrink-0 text-sm">{r.page.icon || '📄'}</span>
                  <span className="flex-1 min-w-0 text-sm truncate">{r.page.title || 'Sans titre'}</span>
                  {parentOf(r.page) && (
                    <span className="text-[11px] flex-shrink-0 max-w-[110px] truncate" style={{ color: 'var(--text-faint)' }}>
                      {parentOf(r.page)}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        <div className="md:hidden" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}
