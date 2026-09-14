'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { LaboPage, searchPages, looksLikeUrl, hostOf, toHref } from './data'

export type Result = { kind: 'page'; page: LaboPage } | { kind: 'url'; href: string } | null

// ── Briques communes ─────────────────────────────────────────────────────────

function PageRow({ p, active, onPick }: { p: LaboPage; active: boolean; onPick: () => void }) {
  return (
    <button onMouseDown={e => { e.preventDefault(); onPick() }}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg"
      style={{ background: active ? 'var(--hover-bg)' : 'transparent' }}>
      <span className="flex-shrink-0 text-sm">{p.icon}</span>
      <span className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</span>
      {/* La page parente départage deux titres identiques — il y en a deux
          dans le jeu d'essai, précisément pour l'éprouver. */}
      {p.parent && <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>{p.parent}</span>}
    </button>
  )
}

function UrlRow({ q, active, onPick }: { q: string; active: boolean; onPick: () => void }) {
  return (
    <button onMouseDown={e => { e.preventDefault(); onPick() }}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg"
      style={{ background: active ? 'var(--hover-bg)' : 'transparent' }}>
      <i className="ti ti-external-link flex-shrink-0" style={{ fontSize: 15, color: 'var(--text-muted)' }} />
      <span className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{hostOf(q)}</span>
      <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>lien externe</span>
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border)', background: 'var(--app-bg)', color: 'var(--text-primary)',
}

// ── A · Un seul champ qui devine ─────────────────────────────────────────────
export function PanelA({ onDone }: { onDone: (r: Result) => void }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const isUrl = looksLikeUrl(q)
  const pages = useMemo(() => searchPages(q), [q])
  // La ligne « lien externe » passe en tête : quand on tape une adresse, c'est
  // elle qu'on veut, et elle doit être sous la touche Entrée.
  const rows: Result[] = useMemo(
    () => [...(isUrl ? [{ kind: 'url' as const, href: toHref(q) }] : []), ...pages.map(p => ({ kind: 'page' as const, page: p }))],
    [isUrl, q, pages]
  )
  useEffect(() => setIdx(0), [q])

  return (
    <div className="flex flex-col gap-2">
      <input autoFocus value={q} onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, rows.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); rows[idx] && onDone(rows[idx]) }
        }}
        placeholder="Chercher une page, ou coller une adresse…"
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
      <div className="flex flex-col" style={{ minHeight: 188 }}>
        {rows.length === 0 && <p className="text-xs px-3 py-3" style={{ color: 'var(--text-muted)' }}>Aucune page à ce nom.</p>}
        {rows.map((r, i) => r!.kind === 'url'
          ? <UrlRow key="url" q={q} active={i === idx} onPick={() => onDone(r)} />
          : <PageRow key={(r as any).page.id} p={(r as any).page} active={i === idx} onPick={() => onDone(r)} />)}
      </div>
    </div>
  )
}

// ── B · Deux onglets ─────────────────────────────────────────────────────────
export function PanelB({ onDone }: { onDone: (r: Result) => void }) {
  const [tab, setTab] = useState<'page' | 'web'>('page')
  const [q, setQ] = useState('')
  const [url, setUrl] = useState('')
  const [idx, setIdx] = useState(0)
  const pages = useMemo(() => searchPages(q), [q])
  useEffect(() => setIdx(0), [q])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex p-0.5 rounded-xl" style={{ background: 'var(--hover-bg)' }}>
        {(['page', 'web'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 text-sm py-1.5 rounded-[10px] font-medium"
            style={{ background: tab === t ? 'var(--card-bg)' : 'transparent',
                     color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                     boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
            {t === 'page' ? 'Une page' : 'Le web'}
          </button>
        ))}
      </div>

      {tab === 'page' ? (
        <>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, pages.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); pages[idx] && onDone({ kind: 'page', page: pages[idx] }) }
            }}
            placeholder="Chercher une page…"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
          <div className="flex flex-col" style={{ minHeight: 188 }}>
            {pages.map((p, i) => <PageRow key={p.id} p={p} active={i === idx} onPick={() => onDone({ kind: 'page', page: p })} />)}
            {pages.length === 0 && <p className="text-xs px-3 py-3" style={{ color: 'var(--text-muted)' }}>Aucune page à ce nom.</p>}
          </div>
        </>
      ) : (
        <div style={{ minHeight: 226 }}>
          <input autoFocus value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && url.trim()) onDone({ kind: 'url', href: toHref(url) }) }}
            placeholder="https://…"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
          <button disabled={!url.trim()} onClick={() => onDone({ kind: 'url', href: toHref(url) })}
            className="mt-2 w-full text-sm py-2.5 rounded-lg disabled:opacity-40"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
            Insérer
          </button>
        </div>
      )}
    </div>
  )
}
