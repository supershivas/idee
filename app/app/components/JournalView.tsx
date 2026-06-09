'use client'
import { useState, useRef, useEffect } from 'react'
import { Page, formatSubtitle } from '../types'
import EmojiPicker from '../EmojiPicker'
import { TagBadge } from './TagsView'

const PAGE_SIZE = 30

function useRelativeTime(iso: string | null | undefined) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!iso) { setLabel(''); return }
    function compute() {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
      if (diff < 60) setLabel('à l\'instant')
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

// ─── JournalList ──────────────────────────────────────────────────────────────
export function JournalList({ entries, selectedId, onSelect, onAdd }: {
  entries: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: () => void
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)
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

  return (
    <div className="flex-1 overflow-y-auto py-4 px-3 md:px-6">
      <div className="page-card my-2 md:my-4 overflow-hidden">
        <div className="flex items-center gap-3 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-2xl">📓</span>
          <h1 className="page-title text-2xl">Journal</h1>
          <span className="text-xs ml-auto mr-3" style={{ color: 'var(--text-muted)' }}>
            {sorted.length} entrée{sorted.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.current
