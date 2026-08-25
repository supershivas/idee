'use client'
import { useRef } from 'react'
import { Page } from '../types'
import { useSwipeDownToDismiss } from './MobileNav'

function getDueDate(page: Page): string | null {
  const tag = (page.tags || []).find(t => t.startsWith('due:'))
  return tag ? tag.slice(4) : null
}

function isOverdue(page: Page): boolean {
  const d = getDueDate(page)
  return !!d && new Date(d) < new Date()
}

function isDueSoon(page: Page): boolean {
  const d = getDueDate(page)
  if (!d) return false
  const diff = new Date(d).getTime() - Date.now()
  return diff >= 0 && diff < 3 * 24 * 60 * 60 * 1000
}

// Même présentation que Paramètres/Corbeille/Historique : modale bottom
// sheet sur mobile, dialogue centré sur desktop, avec swipe vers le bas
// pour fermer.
export default function RecentView({ pages, onSelect, onClose }: {
  pages: Page[]
  onSelect: (p: Page) => void
  onClose: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const swipe = useSwipeDownToDismiss(onClose, contentRef)
  const now = Date.now()
  const recent = [...pages]
    .filter(p => !p.deleted_at)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 20)

  const overdue = pages.filter(p => !p.deleted_at && isOverdue(p))
  const dueSoon = pages.filter(p => !p.deleted_at && isDueSoon(p))

  function formatAgo(iso: string) {
    const diff = now - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `il y a ${mins || 1} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `il y a ${hrs}h`
    const days = Math.floor(hrs / 24)
    return `il y a ${days}j`
  }

  function Section({ title, items }: { title: string; items: Page[] }) {
    if (!items.length) return null
    return (
      <div className="mb-4">
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</p>
        {items.map(p => (
          <button key={p.id}
            onClick={() => onSelect(p)}
            className="u-hover-bg w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm">
            <span>{p.icon || '📄'}</span>
            <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{p.title || 'Sans titre'}</span>
            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-faint)' }}>{formatAgo(p.updated_at)}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div ref={swipe.sheetRef} className="rounded-t-2xl md:rounded-2xl shadow-xl w-full md:w-[560px] md:mx-4 overflow-hidden flex flex-col"
        style={{ background: 'var(--card-bg)', maxHeight: '90vh', ...swipe.style }}
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 md:hidden" style={{ background: 'var(--border)' }} />
        <div className="flex items-center justify-between px-4 pt-4 md:pt-6 pb-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Vue récente</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div ref={contentRef} className="flex-1 overflow-y-auto py-2">
      {overdue.length > 0 && (
        <div className="mb-4">
          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#ef4444' }}>En retard</p>
          {overdue.map(p => {
            const d = getDueDate(p)!
            return (
              <button key={p.id}
                onClick={() => onSelect(p)}
                className="u-hover-bg w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm">
                <span>{p.icon || '📄'}</span>
                <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{p.title || 'Sans titre'}</span>
                <span className="text-[10px] flex-shrink-0 font-medium" style={{ color: '#ef4444' }}>📅 {d}</span>
              </button>
            )
          })}
        </div>
      )}
      {dueSoon.length > 0 && (
        <div className="mb-4">
          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#f59e0b' }}>À venir (3j)</p>
          {dueSoon.map(p => {
            const d = getDueDate(p)!
            return (
              <button key={p.id}
                onClick={() => onSelect(p)}
                className="u-hover-bg w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm">
                <span>{p.icon || '📄'}</span>
                <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{p.title || 'Sans titre'}</span>
                <span className="text-[10px] flex-shrink-0 font-medium" style={{ color: '#f59e0b' }}>📅 {d}</span>
              </button>
            )
          })}
        </div>
      )}
      <Section title="Récemment modifié" items={recent} />
        </div>
      </div>
    </div>
  )
}
