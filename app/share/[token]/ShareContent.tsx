'use client'
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
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

function highlightRange(range: Range, autoRemove = true) {
  removeHighlights()
  const span = document.createElement('span')
  span.className = 'comment-highlight'
  span.style.cssText = 'background:rgba(192,57,43,0.18);border-radius:2px;padding:0 1px;'
  try {
    range.surroundContents(span)
  } catch {
    span.appendChild(range.extractContents())
    range.insertNode(span)
  }
  if (autoRemove) setTimeout(removeHighlights, 5000)
}

function highlightText(text: string, contentEl: HTMLElement | null, autoRemove = true) {
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
        highlightRange(range, autoRemove)
        if (autoRemove) document.querySelector('.comment-highlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {}
      break
    }
  }
}

// ── CommentCard (right-column version) ────────────────────────────────────────
function CommentCard({ comment, allComments, commentsEnabled, onHighlight, onUpdate, onDelete, onReply, authorToken }: {
  comment: Comment
  allComments: Comment[]
  commentsEnabled: boolean
  onHighlight: (text: string) => void
  onUpdate: (c: Comment) => void
  onDelete: (id: string) => void
  onReply: (pseudo: string, text: string) => Promise<{ ok: boolean; error?: string }>
  authorToken: string
}) {
  const isOwn = comment.author_token === authorToken
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(comment.content)
  const [saving, setSaving] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyPseudo, setReplyPseudo] = useState('')
  const [replyText, setReplyText] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [replyError, setReplyError] = useState('')
  const replies = allComments.filter(c => c.parent_id === comment.id)

  useEffect(() => {
    setReplyPseudo(localStorage.getItem(PSEUDO_KEY) || '')
  }, [])

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

  async function submitReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyPseudo.trim() || !replyText.trim()) return
    setReplySubmitting(true)
    setReplyError('')
    const result = await onReply(replyPseudo.trim(), replyText.trim())
    if (!result.ok) {
      setReplyError(result.error || 'Erreur réseau')
    } else {
      localStorage.setItem(PSEUDO_KEY, replyPseudo.trim())
      setShowReplyForm(false)
      setReplyText('')
    }
    setReplySubmitting(false)
  }

  const grouped = groupReactions(comment.reactions || [])

  return (
    <div className={`bg-white rounded-xl border shadow-sm text-[13px] overflow-hidden ${comment.pinned ? 'border-amber-200' : 'border-gray-200'}`}>
      {/* Selected text anchor */}
      {comment.selected_text && (
        <button
          onClick={() => onHighlight(comment.selected_text!)}
          className="w-full text-left px-3 pt-2.5 pb-1.5 border-b border-gray-100 flex items-start gap-2 group"
        >
          <span className="w-0.5 flex-shrink-0 self-stretch rounded-full mt-0.5" style={{ background: '#C0392B' }} />
          <span className="text-[11px] text-gray-400 italic line-clamp-2 group-hover:text-gray-600 transition-colors leading-snug">
            {comment.selected_text}
          </span>
        </button>
      )}

      {/* Main comment */}
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {comment.pinned && <span className="text-[10px] text-amber-600 font-medium">📌</span>}
            <span className="font-semibold text-gray-800 text-[12px]">{comment.author_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {comment.edited_at && <span className="text-[10px] text-gray-400">modifié</span>}
            <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
            {isOwn && !editing && (
              <div className="flex gap-0.5">
                <button onClick={() => { setEditValue(comment.content); setEditing(true) }}
                  className="text-[11px] text-gray-400 hover:text-gray-600 px-0.5">✎</button>
                <button onClick={deleteComment} className="text-[11px] text-gray-400 hover:text-red-500 px-0.5">×</button>
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-1.5">
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3} autoFocus
              className="w-full text-xs rounded-lg px-2 py-1.5 outline-none border border-gray-200 bg-gray-50 resize-none" />
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving || !editValue.trim()}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-900 text-white disabled:opacity-50">
                {saving ? '…' : 'Sauvegarder'}
              </button>
              <button onClick={() => setEditing(false)} className="text-[11px] text-gray-500">Annuler</button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-gray-700 whitespace-pre-wrap leading-snug">{comment.content}</p>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {grouped.map(r => (
            <button key={r.emoji} onClick={() => toggleReaction(r.emoji)}
              className={`flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-colors ${r.mine ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {r.emoji} {r.count}
            </button>
          ))}
          <div className="relative group">
            <button className="text-[11px] text-gray-400 hover:text-gray-600 px-1 py-0.5 rounded-full border border-transparent hover:border-gray-200 transition-colors">
              {grouped.length === 0 ? '😊+' : '+'}
            </button>
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 gap-1 z-10">
              {REACTION_EMOJIS.map(e => (
                <button key={e} onClick={() => toggleReaction(e)}
                  className="text-sm hover:scale-125 transition-transform px-1">{e}</button>
              ))}
            </div>
          </div>
          {commentsEnabled && (
            <button onClick={() => setShowReplyForm(v => !v)}
              className="text-[11px] text-gray-400 hover:text-gray-600 ml-auto transition-colors">
              ↩ Répondre
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="border-t border-gray-100 flex flex-col divide-y divide-gray-100">
          {replies.map(r => (
            <ReplyItem key={r.id} comment={r} authorToken={authorToken} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}

      {/* Inline reply form */}
      {showReplyForm && (
        <form onSubmit={submitReply} className="border-t border-gray-100 px-3 py-2.5 flex flex-col gap-1.5 bg-gray-50">
          <input value={replyPseudo} onChange={e => setReplyPseudo(e.target.value)}
            placeholder="Votre prénom" maxLength={50} required
            className="w-full text-[12px] rounded-lg px-2.5 py-1.5 outline-none border border-gray-200 bg-white" />
          <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
            placeholder="Votre réponse…" maxLength={2000} required rows={2} autoFocus
            className="w-full text-[12px] rounded-lg px-2.5 py-1.5 outline-none border border-gray-200 bg-white resize-none" />
          {replyError && <p className="text-[11px] text-red-500">{replyError}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowReplyForm(false); setReplyText('') }}
              className="text-[11px] text-gray-500">Annuler</button>
            <button type="submit" disabled={replySubmitting || !replyPseudo.trim() || !replyText.trim()}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-900 text-white disabled:opacity-50">
              {replySubmitting ? '…' : 'Envoyer'}
            </button>
          </div>
        </form>
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
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] font-semibold text-gray-700">{comment.author_name}</span>
        <div className="flex items-center gap-1.5">
          {comment.edited_at && <span className="text-[10px] text-gray-400">modifié</span>}
          <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
          {isOwn && !editing && (
            <div className="flex gap-0.5">
              <button onClick={() => { setEditValue(comment.content); setEditing(true) }} className="text-[10px] text-gray-400 hover:text-gray-600">✎</button>
              <button onClick={deleteComment} className="text-[10px] text-gray-400 hover:text-red-500">×</button>
            </div>
          )}
        </div>
      </div>
      {editing ? (
        <div className="flex flex-col gap-1">
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={2} autoFocus
            className="w-full text-[12px] rounded-lg px-2 py-1 outline-none border border-gray-200 bg-white resize-none" />
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving} className="text-[10px] px-2 py-0.5 rounded bg-gray-900 text-white disabled:opacity-50">{saving ? '…' : 'OK'}</button>
            <button onClick={() => setEditing(false)} className="text-[10px] text-gray-500">Annuler</button>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-gray-600 whitespace-pre-wrap leading-snug">{comment.content}</p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ShareContent({ pageId, pageIcon, pageTitle, safeContent, initialComments, commentsEnabled, subpagesBlock }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [bubble, setBubble] = useState<{ x: number; y: number; text: string } | null>(null)
  const [selRects, setSelRects] = useState<{ left: number; top: number; width: number; height: number }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [lastSubmit, setLastSubmit] = useState(0)
  const [positions, setPositions] = useState<Record<string, number>>({})
  const contentRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

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

  // Compute comment positions in right column
  const recalcPositions = useCallback(() => {
    const wrapperEl = wrapperRef.current
    const contentEl = contentRef.current
    if (!wrapperEl || !contentEl) return

    const wrapperRect = wrapperEl.getBoundingClientRect()
    const topLevelVisible = comments.filter(c => !c.parent_id && (showResolved || !c.resolved))

    const items: { id: string; desiredTop: number }[] = []

    for (const c of topLevelVisible) {
      let desiredTop = -1
      if (c.selected_text) {
        const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT)
        let node: Text | null
        while ((node = walker.nextNode() as Text | null)) {
          const idx = (node.textContent || '').indexOf(c.selected_text)
          if (idx >= 0 && node.textContent) {
            try {
              const range = document.createRange()
              range.setStart(node, idx)
              range.setEnd(node, Math.min(idx + c.selected_text.length, node.textContent.length))
              const rect = range.getBoundingClientRect()
              desiredTop = rect.top - wrapperRect.top
            } catch {}
            break
          }
        }
      }
      items.push({ id: c.id, desiredTop })
    }

    // Sort: anchored comments by desiredTop, then unanchored at end
    items.sort((a, b) => {
      if (a.desiredTop < 0 && b.desiredTop < 0) return 0
      if (a.desiredTop < 0) return 1
      if (b.desiredTop < 0) return -1
      return a.desiredTop - b.desiredTop
    })

    const newPositions: Record<string, number> = {}
    let currentBottom = 0

    for (const item of items) {
      const desired = item.desiredTop >= 0 ? item.desiredTop : currentBottom
      const top = Math.max(desired, currentBottom)
      newPositions[item.id] = top
      const cardEl = cardRefs.current[item.id]
      const cardHeight = cardEl ? cardEl.offsetHeight : 100
      currentBottom = top + cardHeight + 8
    }

    setPositions(newPositions)
  }, [comments, showResolved])

  useLayoutEffect(() => {
    recalcPositions()
  }, [recalcPositions])

  // Re-run after card heights settle (handles dynamic content)
  useEffect(() => {
    const timer = setTimeout(recalcPositions, 50)
    return () => clearTimeout(timer)
  }, [recalcPositions])

  // Selection detection
  const handleSelectionEnd = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { setBubble(null); setSelRects([]); return }
    if (!contentRef.current?.contains(sel.anchorNode)) { setBubble(null); setSelRects([]); return }
    const text = sel.toString().trim()
    const range = sel.getRangeAt(0)
    const bounding = range.getBoundingClientRect()
    const rects = Array.from(range.getClientRects()).map(r => ({
      left: r.left, top: r.top, width: r.width, height: r.height,
    }))
    sel.removeAllRanges()
    setSelRects(rects)
    setBubble({ x: bounding.left + bounding.width / 2, y: bounding.top - 8, text })
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', handleSelectionEnd)
    document.addEventListener('touchend', handleSelectionEnd)
    return () => {
      document.removeEventListener('mouseup', handleSelectionEnd)
      document.removeEventListener('touchend', handleSelectionEnd)
    }
  }, [handleSelectionEnd])

  function openForm(text = '') {
    setSelectedText(text)
    setShowForm(true)
    setCommentText('')
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!pseudo.trim() || !commentText.trim()) return
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
          parent_id: null,
          author_token: authorToken,
        }),
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) { setError(data.error || `Erreur ${res.status}`); return }
      localStorage.setItem(PSEUDO_KEY, pseudo.trim())
      setComments(prev => [...prev, data])
      setShowForm(false)
      setSelRects([])
      setLastSubmit(Date.now())
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur réseau') } finally { setSubmitting(false) }
  }

  // Reply submit — needs page_id from closure
  async function submitReplyWithPageId(commentId: string, replyPseudo: string, replyText: string, authorToken: string): Promise<{ ok: boolean; data?: Comment; error?: string }> {
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId,
          author_name: replyPseudo,
          content: replyText,
          parent_id: commentId,
          author_token: authorToken,
        }),
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Erreur réseau' }
    }
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
  const authorToken = typeof window !== 'undefined' ? getAuthorToken() : ''
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
  const [connectorLine, setConnectorLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  useEffect(() => {
    if (!hoveredCommentId) { setConnectorLine(null); return }
    const comment = visible.find(c => c.id === hoveredCommentId)
    if (!comment?.selected_text || !contentRef.current || !wrapperRef.current) { setConnectorLine(null); return }
    const wrapperRect = wrapperRef.current.getBoundingClientRect()
    const cardEl = cardRefs.current[hoveredCommentId]
    if (!cardEl) { setConnectorLine(null); return }
    const cardRect = cardEl.getBoundingClientRect()
    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT)
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const idx = (node.textContent || '').indexOf(comment.selected_text)
      if (idx >= 0 && node.textContent) {
        try {
          const range = document.createRange()
          range.setStart(node, idx)
          range.setEnd(node, Math.min(idx + comment.selected_text.length, node.textContent.length))
          const textRect = range.getBoundingClientRect()
          setConnectorLine({
            x1: textRect.right - wrapperRect.left,
            y1: textRect.top + textRect.height / 2 - wrapperRect.top,
            x2: cardRect.left - wrapperRect.left,
            y2: cardRect.top + cardRect.height / 2 - wrapperRect.top,
          })
        } catch { setConnectorLine(null) }
        break
      }
    }
  }, [hoveredCommentId, visible])

  // Compute total height of right column (for wrapper min-height)
  const rightColHeight = visible.reduce((acc, c) => {
    const pos = positions[c.id] ?? 0
    const h = cardRefs.current[c.id]?.offsetHeight ?? 100
    return Math.max(acc, pos + h)
  }, 0)

  return (
    <>
      {/* Selection overlay */}
      {selRects.map((r, i) => (
        <div key={i} style={{
          position: 'fixed', left: r.left, top: r.top, width: r.width, height: r.height,
          background: 'rgba(192,57,43,0.2)', pointerEvents: 'none', zIndex: 40,
        }} />
      ))}

      {/* Comment bubble */}
      {bubble && commentsEnabled && (
        <button
          onMouseDown={e => {
            e.preventDefault()
            const text = bubble.text
            const sel = window.getSelection()
            if (sel && !sel.isCollapsed) {
              highlightRange(sel.getRangeAt(0).cloneRange())
              sel.removeAllRanges()
            }
            setSelRects([])
            setBubble(null)
            openForm(text)
          }}
          style={{ position: 'fixed', left: bubble.x, top: bubble.y, transform: 'translate(-50%, -100%)', zIndex: 50, background: '#1a1a1a', borderRadius: '9999px', padding: '5px 12px', fontSize: '12px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          💬 Commenter
        </button>
      )}

      {/* New comment form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { setShowForm(false); setSelRects([]) }}>
          <form onClick={e => e.stopPropagation()} onSubmit={submit}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 text-sm">Laisser un commentaire</span>
              <button type="button" onClick={() => { setShowForm(false); setSelRects([]) }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
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
              <button type="button" onClick={() => { setShowForm(false); setSelRects([]) }} className="text-sm px-4 py-2 rounded-lg text-gray-500 hover:text-gray-700">Annuler</button>
              <button type="submit" disabled={submitting || !pseudo.trim() || !commentText.trim()}
                className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50 hover:bg-gray-700 transition-colors">
                {submitting ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-5xl">{pageIcon}</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{pageTitle}</h1>
      {subpagesBlock}

      {/* Two-column layout: content left, comments right */}
      <div ref={wrapperRef} className="relative" style={{ minHeight: rightColHeight > 0 ? rightColHeight : undefined }}>
        {/* Connector line SVG (desktop, hover) */}
        {connectorLine && (
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5, overflow: 'visible' }}>
            <path
              d={`M ${connectorLine.x1} ${connectorLine.y1} C ${connectorLine.x1 + 40} ${connectorLine.y1}, ${connectorLine.x2 - 40} ${connectorLine.y2}, ${connectorLine.x2} ${connectorLine.y2}`}
              fill="none"
              stroke="rgba(192,57,43,0.4)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          </svg>
        )}
        {/* Content — padded right on large screens to leave room for comments */}
        <div className={visible.length > 0 ? 'lg:pr-[320px]' : ''}>
          <div ref={contentRef} className="share-content">
            <style>{`
              .share-content *::selection { background: rgba(192,57,43,0.2); color: inherit; }
              .prose [data-callout] { display:flex;gap:12px;padding:12px 16px;border-radius:12px;margin:8px 0;background:rgba(245,200,66,.12);border-left:3px solid #f5c842;font-size:.9em; }
              .prose [data-callout][color="blue"]  { background:rgba(96,165,250,.12); border-left-color:#60a5fa; }
              .prose [data-callout][color="red"]   { background:rgba(239,68,68,.12);  border-left-color:#ef4444; }
              .prose [data-callout][color="green"] { background:rgba(34,197,94,.12);  border-left-color:#22c55e; }
              /* Task list (checkboxes) */
              .prose ul[data-type="taskList"] { list-style:none; padding-left:0.25rem; }
              .prose ul li:has(> input[type="checkbox"]),
              .prose ul li:has(> label > input[type="checkbox"]) { display:flex; align-items:center; gap:0.5rem; list-style:none; }
              .prose ul li input[type="checkbox"] { flex-shrink:0; width:1rem; height:1rem; cursor:default; }
              .prose ul li:has(> input[type="checkbox"][checked]) > *:not(input),
              .prose ul li:has(> label > input[type="checkbox"][checked]) > *:not(label) { opacity:0.6; text-decoration:line-through; }
            `}</style>
            <div className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: safeContent || '<p class="text-gray-400">Page vide.</p>' }} />
          </div>
        </div>

        {/* Right column — desktop only */}
        {visible.length > 0 && (
          <div className="hidden lg:block absolute top-0 right-0 w-[300px]">
            {visible.map(c => (
              <div
                key={c.id}
                ref={el => { cardRefs.current[c.id] = el }}
                onMouseEnter={() => { setHoveredCommentId(c.id); if (c.selected_text) highlightText(c.selected_text, contentRef.current, false) }}
                onMouseLeave={() => { setHoveredCommentId(null); setConnectorLine(null); removeHighlights() }}
                style={{
                  position: 'absolute',
                  top: positions[c.id] ?? 0,
                  width: '100%',
                  opacity: positions[c.id] !== undefined ? 1 : 0,
                  transition: 'top 0.2s ease, opacity 0.15s ease',
                }}
              >
                <CommentCard
                  comment={c}
                  allComments={comments}
                  commentsEnabled={commentsEnabled}
                  authorToken={authorToken}
                  onHighlight={text => highlightText(text, contentRef.current)}
                  onUpdate={updateComment}
                  onDelete={deleteComment}
                  onReply={(rp, rt) => submitReplyWithPageId(c.id, rp, rt, authorToken)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Mobile — comments below content */}
        {visible.length > 0 && (
          <div className="lg:hidden mt-10 pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {totalCount > 0 ? `${totalCount} commentaire${totalCount > 1 ? 's' : ''}` : 'Commentaires'}
              </h2>
              {resolvedCount > 0 && (
                <button onClick={() => setShowResolved(v => !v)} className="text-xs text-gray-400 hover:text-gray-600">
                  {showResolved ? 'Masquer résolus' : `${resolvedCount} résolu${resolvedCount > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {visible.map(c => (
                <CommentCard key={c.id} comment={c} allComments={comments} commentsEnabled={commentsEnabled}
                  authorToken={authorToken}
                  onHighlight={text => highlightText(text, contentRef.current)}
                  onUpdate={updateComment} onDelete={deleteComment}
                  onReply={(rp, rt) => submitReplyWithPageId(c.id, rp, rt, authorToken)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comment controls bar (always visible) */}
      <div className="mt-10 pt-6 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="text-xs text-gray-400">
              {totalCount} commentaire{totalCount > 1 ? 's' : ''}
            </span>
          )}
          {resolvedCount > 0 && (
            <button onClick={() => setShowResolved(v => !v)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors hidden lg:inline">
              {showResolved ? 'Masquer résolus' : `${resolvedCount} résolu${resolvedCount > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {commentsEnabled && (
            <button onClick={() => { setBubble(null); openForm('') }}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
              + Commenter
            </button>
          )}
          <p className="text-xs text-gray-400">Créé avec <a href="/" className="hover:text-gray-600">Idée</a></p>
        </div>
      </div>

      {!commentsEnabled && (
        <p className="text-sm text-gray-400 py-4">Les commentaires sont désactivés pour cette page.</p>
      )}

      {commentsEnabled && visible.length === 0 && (
        <p className="text-sm text-gray-400 py-2">
          {totalCount === 0 ? 'Aucun commentaire. Sélectionnez du texte pour en laisser un.' : 'Tous les commentaires sont résolus.'}
        </p>
      )}
    </>
  )
}
