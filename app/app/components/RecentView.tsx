'use client'
import { Page } from '../types'

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

export default function RecentView({ pages, onSelect }: {
  pages: Page[]
  onSelect: (p: Page) => void
}) {
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
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Vue récente</h2>
      </div>
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
  )
}
