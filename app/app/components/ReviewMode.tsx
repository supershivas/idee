'use client'
import { useState, useCallback } from 'react'
import { Page } from '../types'

function tiptapToPlainText(content: string): string {
  if (!content) return ''
  try {
    const doc = JSON.parse(content)
    const parts: string[] = []
    const stack: { content?: unknown[] }[] = [doc]
    while (stack.length) {
      const node = stack.pop() as { type?: string; text?: string; content?: unknown[] }
      if (node?.type === 'text' && node.text) parts.push(node.text)
      if (Array.isArray(node?.content)) {
        for (let i = node.content.length - 1; i >= 0; i--) {
          stack.push(node.content[i] as { content?: unknown[] })
        }
      }
    }
    return parts.join(' ')
  } catch {
    return content.replace(/<[^>]+>/g, ' ').trim()
  }
}

export default function ReviewMode({ pages, onNavigate, onClose }: {
  pages: Page[]
  onNavigate: (p: Page) => void
  onClose: () => void
}) {
  const pool = pages.filter(p => !p.deleted_at && p.type !== 'journal' && (p.content || p.title))
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [current, setCurrent] = useState<Page | null>(() => {
    if (!pool.length) return null
    return pool[Math.floor(Math.random() * pool.length)]
  })
  const [revealed, setRevealed] = useState(false)

  const next = useCallback(() => {
    const newSeen = new Set(seen)
    if (current) newSeen.add(current.id)
    setSeen(newSeen)
    const remaining = pool.filter(p => !newSeen.has(p.id))
    if (!remaining.length) { setCurrent(null); return }
    setCurrent(remaining[Math.floor(Math.random() * remaining.length)])
    setRevealed(false)
  }, [current, pool, seen])

  const remaining = pool.filter(p => !seen.has(p.id)).length

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Mode révision</span>
            {pool.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--selected-bg)', color: 'var(--text-muted)' }}>
                {remaining} / {pool.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>✕ Fermer</button>
        </div>

        {!current ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🎉</p>
            <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Toutes les notes révisées !</p>
            <button onClick={() => { setSeen(new Set()); setCurrent(pool[Math.floor(Math.random() * pool.length)]); setRevealed(false) }}
              className="mt-4 px-4 py-2 text-sm rounded-xl"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
              Recommencer
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-8 shadow-lg"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{current.icon || '📄'}</span>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {current.title || 'Sans titre'}
              </h2>
            </div>

            {!revealed ? (
              <button onClick={() => setRevealed(true)}
                className="w-full py-6 rounded-xl border-2 border-dashed text-sm transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--btn-primary-bg)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                Cliquer pour révéler le contenu
              </button>
            ) : (
              <p className="text-sm leading-relaxed line-clamp-6" style={{ color: 'var(--text-secondary)' }}>
                {tiptapToPlainText(current.content).slice(0, 400) || '(page vide)'}
              </p>
            )}

            <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => onNavigate(current)}
                className="text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                → Ouvrir la page
              </button>
              <button onClick={next}
                className="px-4 py-2 text-sm rounded-xl font-medium"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
                {remaining <= 1 ? 'Terminer' : 'Suivante →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
