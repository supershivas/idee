'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface Comment {
  id: string
  author_name: string
  content: string
  selected_text: string | null
  created_at: string
}

interface Props {
  pageId: string
  pageIcon: string
  pageTitle: string
  safeContent: string
  initialComments: Comment[]
  subpagesBlock: React.ReactNode
}

const PSEUDO_KEY = 'idee_comment_pseudo'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

export default function ShareContent({ pageId, pageIcon, pageTitle, safeContent, initialComments, subpagesBlock }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [bubble, setBubble] = useState<{ x: number; y: number; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPseudo(localStorage.getItem(PSEUDO_KEY) || '')
  }, [])

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setBubble(null)
      return
    }
    if (!contentRef.current?.contains(sel.anchorNode)) {
      setBubble(null)
      return
    }
    const text = sel.toString().trim()
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    // Use viewport coordinates (fixed positioning)
    setBubble({ x: rect.left + rect.width / 2, y: rect.top - 8, text })
    setSelectedText(text)
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseUp])

  function openForm() {
    window.getSelection()?.removeAllRanges()
    setBubble(null)
    setShowForm(true)
    setCommentText('')
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!pseudo.trim() || !commentText.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: pageId, author_name: pseudo, content: commentText, selected_text: selectedText || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur'); return }
      localStorage.setItem(PSEUDO_KEY, pseudo.trim())
      setComments(prev => [...prev, data])
      setShowForm(false)
      setSelectedText('')
    } catch { setError('Erreur réseau') } finally { setSubmitting(false) }
  }

  return (
    <>
      {/* Floating bubble on text selection */}
      {bubble && (
        <button
          onClick={openForm}
          style={{ position: 'fixed', left: bubble.x, top: bubble.y, transform: 'translate(-50%, -100%)', zIndex: 50, background: '#1a1a1a', borderRadius: '9999px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer' }}
        >
          💬 Commenter
        </button>
      )}

      {/* Comment form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowForm(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submit}
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 dark:text-white text-sm">Laisser un commentaire</span>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>

            {selectedText && (
              <blockquote className="text-xs text-gray-500 border-l-2 border-gray-300 pl-3 italic line-clamp-3">
                {selectedText}
              </blockquote>
            )}

            <input
              value={pseudo}
              onChange={e => setPseudo(e.target.value)}
              placeholder="Votre prénom ou pseudo"
              maxLength={50}
              required
              className="w-full text-sm rounded-lg px-3 py-2 outline-none border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Votre commentaire…"
              maxLength={2000}
              required
              rows={3}
              autoFocus
              className="w-full text-sm rounded-lg px-3 py-2 outline-none border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="text-sm px-4 py-2 rounded-lg text-gray-500 hover:text-gray-700">
                Annuler
              </button>
              <button type="submit" disabled={submitting || !pseudo.trim() || !commentText.trim()}
                className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50 hover:bg-gray-700 transition-colors">
                {submitting ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Page content */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-5xl">{pageIcon}</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{pageTitle}</h1>

      {subpagesBlock}

      <div ref={contentRef}>
        <style>{`
          .prose [data-callout] {
            display: flex;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 12px;
            margin: 8px 0;
            background: rgba(245,200,66,0.12);
            border-left: 3px solid #f5c842;
            font-size: 0.9em;
          }
          .prose [data-callout][color="blue"]  { background: rgba(96,165,250,0.12); border-left-color: #60a5fa; }
          .prose [data-callout][color="red"]   { background: rgba(239,68,68,0.12);  border-left-color: #ef4444; }
          .prose [data-callout][color="green"] { background: rgba(34,197,94,0.12);  border-left-color: #22c55e; }
        `}</style>
        <div className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: safeContent || '<p class="text-gray-400">Page vide.</p>' }}
        />
      </div>

      {/* Comments section */}
      <div className="mt-10 pt-8 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {comments.length > 0 ? `${comments.length} commentaire${comments.length > 1 ? 's' : ''}` : 'Commentaires'}
          </h2>
          <button onClick={() => { setSelectedText(''); openForm() }}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
            + Commenter
          </button>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Aucun commentaire. Sélectionnez du texte pour en laisser un.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {comments.map(c => (
              <div key={c.id} className="flex flex-col gap-1.5">
                {c.selected_text && (
                  <blockquote className="text-xs text-gray-400 border-l-2 border-gray-200 pl-3 italic line-clamp-2">
                    {c.selected_text}
                  </blockquote>
                )}
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-700">{c.author_name}</span>
                    <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 pt-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">Créé avec <a href="/" className="hover:text-gray-600">Idée</a></p>
      </div>
    </>
  )
}
