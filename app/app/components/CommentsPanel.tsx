'use client'
import { useEffect, useState } from 'react'

interface Reaction { emoji: string; author_token: string }
interface Comment {
  id: string
  parent_id: string | null
  author_name: string
  content: string
  selected_text: string | null
  created_at: string
  edited_at?: string | null
  resolved: boolean
  pinned: boolean
  reactions: Reaction[]
}

type Filter = 'all' | 'unresolved' | 'pinned'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

function groupReactions(reactions: Reaction[]) {
  const map: Record<string, number> = {}
  for (const r of reactions) map[r.emoji] = (map[r.emoji] || 0) + 1
  return Object.entries(map).map(([emoji, count]) => ({ emoji, count }))
}

const SEEN_KEY = (id: string) => `idee_comments_seen_${id}`

export function useCommentsCount(pageId: string | null) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!pageId) return
    fetch(`/api/comments?pageId=${pageId}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setCount(data.length))
      .catch(() => {})
  }, [pageId])
  return count
}

export function useUnreadCommentsCount(pageId: string | null) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!pageId) return
    const seenAt = localStorage.getItem(SEEN_KEY(pageId))
    fetch(`/api/comments?pageId=${pageId}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return
        const unread = seenAt ? data.filter((c: Comment) => new Date(c.created_at) > new Date(seenAt)).length : data.length
        setCount(unread)
      })
      .catch(() => {})
  }, [pageId])
  return count
}

export function CommentsPanel({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('unresolved')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/comments?pageId=${pageId}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setComments(data))
      .catch(() => {})
      .finally(() => {
        setLoading(false)
        localStorage.setItem(SEEN_KEY(pageId), new Date().toISOString())
      })
  }, [pageId])

  async function togglePin(comment: Comment) {
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pin', value: !comment.pinned }),
    })
    if (res.ok) setComments(prev => prev.map(c => c.id === comment.id ? { ...c, pinned: !comment.pinned } : c))
  }

  async function toggleResolve(comment: Comment) {
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', value: !comment.resolved }),
    })
    if (res.ok) setComments(prev => prev.map(c => c.id === comment.id ? { ...c, resolved: !comment.resolved } : c))
  }

  async function deleteComment(id: string) {
    if (!confirm('Supprimer ce commentaire ?')) return
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    if (res.ok) setComments(prev => prev.filter(c => c.id !== id))
  }

  const topLevel = comments.filter(c => !c.parent_id)
  const filtered = filter === 'all' ? topLevel : filter === 'pinned' ? topLevel.filter(c => c.pinned) : topLevel.filter(c => !c.resolved)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="h-full w-full max-w-sm flex flex-col shadow-2xl"
        style={{ background: 'var(--card-bg)', borderLeft: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Commentaires <span style={{ color: 'var(--text-muted)' }}>({comments.length})</span>
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-lg transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        <div className="flex gap-1 px-5 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {(['unresolved', 'all', 'pinned'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{ background: filter === f ? 'var(--hover-bg)' : 'transparent', color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {f === 'unresolved' ? 'Ouverts' : f === 'all' ? 'Tous' : '📌 Épinglés'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {filter === 'pinned' ? 'Aucun commentaire épinglé.' : filter === 'unresolved' ? 'Tout est résolu 🎉' : 'Aucun commentaire.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map(c => {
                const replies = comments.filter(r => r.parent_id === c.id)
                const grouped = groupReactions(c.reactions || [])
                return (
                  <div key={c.id} className={`flex flex-col gap-1 ${c.resolved ? 'opacity-50' : ''}`}>
                    {c.selected_text && (
                      <blockquote className="text-xs italic pl-3 line-clamp-2" style={{ color: 'var(--text-faint)', borderLeft: '2px solid var(--border)' }}>
                        {c.selected_text}
                      </blockquote>
                    )}
                    <div className="rounded-xl px-4 py-3" style={{ background: c.pinned ? 'rgba(245,158,11,0.08)' : 'var(--hover-bg)', border: c.pinned ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent' }}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          {c.pinned && <span className="text-[10px] text-amber-500 font-medium block">📌 Épinglé</span>}
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.author_name}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{timeAgo(c.created_at)}</span>
                          <button onClick={() => togglePin(c)} title={c.pinned ? 'Désépingler' : 'Épingler'}
                            className="text-[11px] px-1.5 py-0.5 rounded transition-opacity hover:opacity-100 opacity-40"
                            style={{ color: c.pinned ? '#f59e0b' : 'var(--text-muted)' }}>📌</button>
                          <button onClick={() => toggleResolve(c)} title={c.resolved ? 'Rouvrir' : 'Résoudre'}
                            className="text-[11px] px-1.5 py-0.5 rounded transition-opacity hover:opacity-100 opacity-40"
                            style={{ color: c.resolved ? '#22c55e' : 'var(--text-muted)' }}>✓</button>
                          <button onClick={() => deleteComment(c.id)} title="Supprimer"
                            className="text-[11px] px-1.5 py-0.5 rounded transition-opacity hover:opacity-100 opacity-40"
                            style={{ color: 'var(--text-muted)' }}>×</button>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{c.content}</p>
                      {grouped.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {grouped.map(r => (
                            <span key={r.emoji} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                              {r.emoji} {r.count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {replies.length > 0 && (
                      <div className="ml-3 pl-3 flex flex-col gap-1.5" style={{ borderLeft: '2px solid var(--border)' }}>
                        {replies.map(r => (
                          <div key={r.id} className="rounded-xl px-3 py-2" style={{ background: 'var(--hover-bg)' }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.author_name}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{timeAgo(r.created_at)}</span>
                                <button onClick={() => deleteComment(r.id)} className="text-[11px] opacity-40 hover:opacity-100" style={{ color: 'var(--text-muted)' }}>×</button>
                              </div>
                            </div>
                            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{r.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
