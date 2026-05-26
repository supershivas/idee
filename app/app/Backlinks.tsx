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
    <div className="px-4 md:px-8 py-6 border-t border-gray-100" style={{ maxWidth: '720px' }}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Référencé dans {backlinks.length} page{backlinks.length > 1 ? 's' : ''}
      </p>
      <div className="flex flex-col gap-1">
        {backlinks.map(page => (
          <button key={page.id} onClick={() => onNavigate(page)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left group w-fit">
            <span className="text-base flex-shrink-0">{page.icon || '📄'}</span>
            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{page.title || 'Sans titre'}</span>
            <span className="text-gray-300 group-hover:text-gray-500 text-xs opacity-0 group-hover:opacity-100 transition-all">↗</span>
          </button>
        ))}
      </div>
    </div>
  )
}
