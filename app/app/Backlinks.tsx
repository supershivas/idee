'use client'
import { useMemo } from 'react'
import { Page } from './types'

export function Backlinks({ currentPage, pages, onNavigate }: {
  currentPage: Page
  pages: Page[]
  onNavigate: (p: Page) => void
}) {
  const backlinks = useMemo(() => {
    return pages.filter(p => {
      if (p.id === currentPage.id || p.deleted_at) return false
      if (!p.content) return false
      return p.content.includes(`data-page-id="${currentPage.id}"`)
    })
  }, [pages, currentPage.id])

  if (backlinks.length === 0) return null

  return (
    <div
      className="px-4 md:px-8 py-5"
      style={{
        borderTop: '1px solid var(--border)',
        maxWidth: '720px',
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        Référencé dans {backlinks.length} page{backlinks.length > 1 ? 's' : ''}
      </p>
      <div className="flex flex-col gap-0.5">
        {backlinks.map(page => (
          <button
            key={page.id}
            onClick={() => onNavigate(page)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left w-fit group"
            style={{ color: 'var(--text-secondary)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <span className="text-base flex-shrink-0">{page.icon || '📄'}</span>
            <span className="text-sm">{page.title || 'Sans titre'}</span>
            <span className="text-xs opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--text-muted)' }}>↗</span>
          </button>
        ))}
      </div>
    </div>
  )
}
