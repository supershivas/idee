'use client'
import { useEffect, useState } from 'react'

interface Comment {
  id: string
  author_name: string
  content: string
  selected_text: string | null
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

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

export function CommentsPanel({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/comments?pageId=${pageId}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setComments(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [pageId])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm flex flex-col shadow-2xl"
        style={{ background: 'var(--card-bg)', borderLeft: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Commentaires {comments.length > 0 && <span style={{ color: 'var(--text-muted)' }}>({comments.length})</span>}
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-lg transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
          ) : comments.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun commentaire pour l'instant.</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Les lecteurs peuvent commenter via le lien partagé.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {comments.map(c => (
                <div key={c.id} className="flex flex-col gap-1.5">
                  {c.selected_text && (
                    <blockquote className="text-xs italic pl-3 line-clamp-2" style={{ color: 'var(--text-faint)', borderLeft: '2px solid var(--border)' }}>
                      {c.selected_text}
                    </blockquote>
                  )}
                  <div className="rounded-xl px-4 py-3" style={{ background: 'var(--hover-bg)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.author_name}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
