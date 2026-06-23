'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  author_token: string | null
  reactions: Reaction[]
}

interface Props {
  pageId: string
  pageIcon: string
  pageTitle: string
  safeContent: string
  initialComments: Comment[]
  commentsEnabled: boolean
  subpagesBlock: React.ReactNode
}

const PSEUDO_KEY = 'idee_comment_pseudo'
const AUTHOR_TOKEN_KEY = 'idee_author_token'
const SEEN_KEY = (id: string) => `idee_comments_seen_${id}`
const REACTION_EMOJIS = ['👍', '❤️', '💡', '😮', '😄']

function getAuthorToken(): string {
  if (typeof window === 'undefined') return ''
  let t = localStorage.getItem(AUTHOR_TOKEN_KEY)
  if (!t) { t = crypto.randomUUID(); localStorage.setItem(AUTHOR_TOKEN_KEY, t) }
  return t
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

function groupReactions(reactions: Reaction[]): { emoji: string; count: number; mine: boolean }[] {
  const authorToken = typeof window !== 'undefined' ? localStorage.getItem(AUTHOR_TOKEN_KEY) : ''
  const map: Record<string, { count: number; mine: boolean }> = {}
  for (const r of reactions) {
    if (!map[r.emoji]) map[r.emoji] = { count: 0, mine: false }
    map[r.emoji].count++
    if (r.author_token === authorToken) map[r.emoji].mine = true
  }
  return Object.entries(map).map(([emoji, v]) => ({ emoji, ...v }))
}

function removeHighlights() {
  document.querySelectorAll('.comment-highlight').forEach(el => {
    const parent = el.parentNode
    if (!parent) return
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
  })
}

function highlightRange(range: Range) {
  removeHighlights()
  const span = document.createElement('span')
  span.className = 'comment-highlight'
  span.style.cssText = 'background:rgba(192,57,43,0.18);border-radius:2px;padding:0 1px;'
  try {
    // Works when selection stays within a single element
    range.surroundContents(span)
  } catch {
    // Cross-element selection: extract fragment, wrap it, reinsert
    span.appendChild(range.extractContents())
    range.insertNode(span)
  }
  setTimeout(removeHighlights, 5000)
}

function highlightText(text: string, contentEl: HTMLElement | null) {
  removeHighlights()
  if (!text || !contentEl) return
  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const idx = (node.textContent || '').indexOf(text)
    if (idx >= 0 && node.textContent) {
      try {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + text.length)
        highlightRange(range)
        document.querySelector('.comment-highlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {}
      break
    }
  }
}

// ── CommentItem ────────────────────────────────────────────────────────────────
function CommentItem({ comment, allComments, commentsEnabled, onReply, onHighlight, onUpdate, onDelete }: {
  comment: Comment
  allComments: Comment[]
  commentsEnabled: boolean
  onReply: (parentId: string, parentAuthor: string) => void
  onHighlight: (text: string) => void
  onUpdate: (c: Comment) => void
  onDelete: (id: string) => void
}) {
  const authorToken = getAuthorToken()
  const isOwn = comment.author_token === authorToken
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(comment.content)
  const [saving, setSaving] = useState(false)
  const replies = allComments.filter(c => c.parent_id === comment.id)

  async function saveEdit() {
    if (!editValue.trim()) return
    setSaving(true)
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', content: editValue, author_token: authorToken }),
    })
    if (res.ok) { onUpdate(await res.json()); setEditing(false) }
    setSaving(false)
  }

  async function deleteComment() {
    if (!confirm('Supprimer ce commentaire ?')) return
    await fetch(`/api/comments/${comment.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_token: authorToken }),
    })
    onDelete(comment.id)
  }

  async function toggleReaction(emoji: string) {
    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: comment.id, emoji, author_token: authorToken }),
    })
    if (!res.ok) return
    const { action } = await res.json()
    const newReactions = action === 'added'
      ? [...comment.reactions, { emoji, author_token: authorToken }]
      : comment.reactions.filter(r => !(r.emoji === emoji && r.author_token === authorToken))
    onUpdate({ ...comment, reactions: newReactions })
  }

  if (comment.resolved) return null // handled by parent (filtered with toggle)

  const grouped = groupReactions(comment.reactions || [])

  return (
    <div className={`flex flex-col gap-1.5 ${comment.pinned ? 'order-first' : ''}`}>
      {comment.selected_text && (
        <button
          onClick={() => onHighlight(comment.selected_text!)}
          className="text-xs text-gray-400 border-l-2 border-gray-200 pl-3 italic line-clamp-2 text-left hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          {comment.selected_text}
        </button>
      )}
      <div className={`rounded-xl px-4 py-3 ${comment.pinned ? 'ring-1 ring-amber-200 bg-amber-50' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {comment.pinned && <span className="text-[10px] text-amber-600 font-medium">📌 Épinglé</span>}
            <span className="text-xs font-medium text-gray-700">{comment.author_name}</span>
          </div>
          <div className="flex items-center gap-2">
            {comment.edited_at && <span className="text-[10px] text-gray-400">modifié</span>}
            <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
            {isOwn && !editing && (
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditValue(comment.content); setEditing(true) }}
                  className="text-[10px] text-gray-400 hover:text-gray-600">✎</button>
                <button onClick={deleteComment} className="text-[10px] text-gray-400 hover:text-red-500">×</button>
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3} autoFocus
              className="w-full text-sm rounded-lg px-3 py-2 outline-none border border-gray-200 bg-white resize-none" />
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving || !editValue.trim()}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-50">
                {saving ? '…' : 'Sauvegarder'}
              </button>
              <button onClick={() => setEditing(false)} className="text-xs text-gray-500">Annuler</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {grouped.map(r => (
            <button key={r.emoji} onClick={() => toggleReaction(r.emoji)}
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${r.mine ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {r.emoji} {r.count}
            </button>
          ))}
          <div className="relative group">
            <button className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded-full border border-transparent hover:border-gray-200 transition-colors">
              {grouped.length === 0 ? '😊 +' : '+'}
            </button>
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 gap-1 z-10">
              {REACTION_EMOJIS.map(e => (
                <button key={e} onClick={() => toggleReaction(e)}
                  className="text-base hover:scale-125 transition-transform px-1">{e}</button>
              ))}
            </div>
          </div>
          {commentsEnabled && (
            <button onClick={() => onReply(comment.id, comment.author_name)}
              className="text-[11px] text-gray-400 hover:text-gray-600 ml-auto transition-colors">
              ↩ Répondre
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-4 flex flex-col gap-2 border-l-2 border-gray-100 pl-3">
          {replies.map(r => (
            <ReplyItem key={r.id} comment={r} authorToken={authorToken} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReplyItem({ comment, authorToken, onUpdate, onDelete }: {
  comment: Comment; authorToken: string
  onUpdate: (c: Comment) => void; onDelete: (id: string) => void
}) {
  const isOwn = comment.author_token === authorToken
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(comment.content)
  const [saving, setSaving] = useState(false)

  async function saveEdit() {
    if (!editValue.trim()) return
    setSaving(true)
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', content: editValue, author_token: authorToken }),
    })
    if (res.ok) { onUpdate(await res.json()); setEditing(false) }
    setSaving(false)
  }

  async function deleteComment() {
    if (!confirm('Supprimer ?')) return
    await fetch(`/api/comments/${comment.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_token: authorToken }),
    })
    onDelete(comment.id)
  }

  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">{comment.author_name}</span>
        <div className="flex items-center gap-2">
          {comment.edited_at && <span className="text-[10px] text-gray-400">modifié</span>}
          <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
          {isOwn && !editing && (
            <div className="flex gap-1">
              <button onClick={() => { setEditValue(comment.content); setEditing(true) }} className="text-[10px] text-gray-400 hover:text-gray-600">✎</button>
              <button onClick={deleteComment} className="text-[10px] text-gray-400 hover:text-red-500">×</button>
            </div>
          )}
        </div>
      </div>
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={2} autoFocus
            className="w-full text-sm rounded-lg px-2 py-1.5 outline-none border border-gray-200 bg-white resize-none" />
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving} className="text-xs px-2 py-1 rounded-lg bg-gray-900 text-white disabled:opacity-50">{saving ? '…' : 'OK'}</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500">Annuler</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{comment.content}</p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ShareContent({ pageId, pageIcon, pageTitle, safeContent, initialComments, commentsEnabled, subpagesBlock }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [bubble, setBubble] = useState<{ x: number; y: number; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null)
  const [pseudo, setPseudo] = useState('')
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [lastSubmit, setLastSubmit] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPseudo(localStorage.getItem(PSEUDO_KEY) || '')
  }, [])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`comments:${pageId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'page_comments', filter: `page_id=eq.${pageId}` },
        payload => setComments(prev => prev.find(c => c.id === (payload.new as Comment).id) ? prev : [...prev, { ...(payload.new as Comment), reactions: [] }]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'page_comments', filter: `page_id=eq.${pageId}` },
        payload => setComments(prev => prev.map(c => c.id === (payload.new as Comment).id ? { ...c, ...(payload.new as Comment) } : c)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'page_comments' },
        payload => setComments(prev => prev.filter(c => c.id !== (payload.old as any).id)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [pageId])

  // Selection detection (mouse + touch)
  const handleSelectionEnd = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { setBubble(null); return }
    if (!contentRef.current?.contains(sel.anchorNode)) { setBubble(null); return }
    const text = sel.toString().trim()
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    // On garde la sélection native visible — elle disparaîtra quand l'utilisateur clique ailleurs
    setBubble({ x: rect.left + rect.width / 2, y: rect.top - 8, text })
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', handleSelectionEnd)
    document.addEventListener('touchend', handleSelectionEnd)
    return () => {
      document.removeEventListener('mouseup', handleSelectionEnd)
      document.removeEventListener('touchend', handleSelectionEnd)
    }
  }, [handleSelectionEnd])

  function openForm(text = '', reply: { id: string; author: string } | null = null) {
    setSelectedText(text)
    setReplyTo(reply)
    setShowForm(true)
    setCommentText('')
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!pseudo.trim() || !commentText.trim()) return
    // Rate limiting: 1 message per 15s
    if (Date.now() - lastSubmit < 15000) { setError('Attendez un peu avant de poster à nouveau.'); return }
    setSubmitting(true)
    setError('')
    try {
      const authorToken = getAuthorToken()
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId,
          author_name: pseudo,
          content: commentText,
          selected_text: selectedText || null,
          parent_id: replyTo?.id || null,
          author_token: authorToken,
        }),
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) { setError(data.error || `Erreur ${res.status}`); return }
      localStorage.setItem(PSEUDO_KEY, pseudo.trim())
      setComments(prev => [...prev, data])
      setShowForm(false)
      setLastSubmit(Date.now())
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur réseau') } finally { setSubmitting(false) }
  }

  function updateComment(updated: Comment) {
    setComments(prev => prev.map(c => c.id === updated.id ? updated : c))
  }
  function deleteComment(id: string) {
    setComments(prev => prev.filter(c => c.id !== id))
  }

  const topLevel = comments.filter(c => !c.parent_id)
  const visible = showResolved ? topLevel : topLevel.filter(c => !c.resolved)
  const resolvedCount = topLevel.filter(c => c.resolved).length
  const totalCount = comments.length

  return (
    <>
      {/* Bubble */}
      {bubble && commentsEnabled && (
        <button
          onMouseDown={e => {
            e.preventDefault()
            const text = bubble.text
            // Applique le highlight custom puis efface la sélection native avant d'ouvrir la modale
            const sel = window.getSelection()
            if (sel && !sel.isCollapsed) {
              highlightRange(sel.getRangeAt(0).cloneRange())
              sel.removeAllRanges()
            }
            setBubble(null)
            openForm(text)
          }}
          style={{ position: 'fixed', left: bubble.x, top: bubble.y, transform: 'translate(-50%, -100%)', zIndex: 50, background: '#1a1a1a', borderRadius: '9999px', padding: '5px 12px', fontSize: '12px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          💬 Commenter
        </button>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowForm(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submit}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 text-sm">
                {replyTo ? `Répondre à ${replyTo.author}` : 'Laisser un commentaire'}
              </span>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            {selectedText && (
              <div className="text-xs rounded-lg px-3 py-2 border-l-2 italic"
                style={{ background: 'rgba(192,57,43,0.08)', borderColor: '#C0392B', color: '#9B2D22' }}>
                « {selectedText} »
              </div>
            )}
            <input value={pseudo} onChange={e => setPseudo(e.target.value)}
              placeholder="Votre prénom ou pseudo" maxLength={50} required
              className="w-full text-sm rounded-lg px-3 py-2 outline-none border border-gray-200" />
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="Votre commentaire…" maxLength={2000} required rows={3} autoFocus
              className="w-full text-sm rounded-lg px-3 py-2 outline-none border border-gray-200 resize-none" />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg text-gray-500 hover:text-gray-700">Annuler</button>
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
          .prose [data-callout] { display:flex;gap:12px;padding:12px 16px;border-radius:12px;margin:8px 0;background:rgba(245,200,66,.12);border-left:3px solid #f5c842;font-size:.9em; }
          .prose [data-callout][color="blue"]  { background:rgba(96,165,250,.12); border-left-color:#60a5fa; }
          .prose [data-callout][color="red"]   { background:rgba(239,68,68,.12);  border-left-color:#ef4444; }
          .prose [data-callout][color="green"] { background:rgba(34,197,94,.12);  border-left-color:#22c55e; }
        `}</style>
        <div className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: safeContent || '<p class="text-gray-400">Page vide.</p>' }} />
      </div>

      {/* Comments section */}
      <div className="mt-10 pt-8 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {totalCount > 0 ? `${totalCount} commentaire${totalCount > 1 ? 's' : ''}` : 'Commentaires'}
            </h2>
            {resolvedCount > 0 && (
              <button onClick={() => setShowResolved(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                {showResolved ? 'Masquer résolus' : `${resolvedCount} résolu${resolvedCount > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
          {commentsEnabled && (
            <button onClick={() => { setBubble(null); openForm('') }}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
              + Commenter
            </button>
          )}
        </div>

        {!commentsEnabled && (
          <p className="text-sm text-gray-400 py-4">Les commentaires sont désactivés pour cette page.</p>
        )}

        {commentsEnabled && visible.length === 0 && (
          <p className="text-sm text-gray-400 py-4">
            {totalCount === 0 ? 'Aucun commentaire. Sélectionnez du texte pour en laisser un.' : 'Tous les commentaires sont résolus.'}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {visible.map(c => (
            <CommentItem key={c.id} comment={c} allComments={comments} commentsEnabled={commentsEnabled}
              onReply={(id, author) => openForm('', { id, author })}
              onHighlight={text => highlightText(text, contentRef.current)}
              onUpdate={updateComment} onDelete={deleteComment} />
          ))}
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">Créé avec <a href="/" className="hover:text-gray-600">Idée</a></p>
      </div>
    </>
  )
}
