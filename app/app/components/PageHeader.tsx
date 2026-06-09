'use client'
import { useState, useRef, useEffect } from 'react'
import { Page, formatSubtitle } from '../types'
import EmojiPicker from '../EmojiPicker'
import { TagsInput } from './TagsView'
import { PageMetadata } from './JournalView'
import { ActionsMenu } from './ActionsMenu'
import HistoryButton from '../HistoryButton'
import ExportButton from '../ExportButton'
import ShareButton from '../ShareButton'

function BreadcrumbInline({ pages, selected, onSelect }: { pages: Page[], selected: Page | null, onSelect: (p: Page) => void }) {
  if (!selected) return null
  const crumbs: Page[] = []
  let current: Page | undefined = selected
  while (current) { crumbs.unshift(current); current = pages.find(p => p.id === current!.parent_id) }
  const ancestors = crumbs.slice(0, -1)
  if (ancestors.length === 0) return <div className="flex-1 min-w-0" />
  return (
    <div className="flex items-center gap-1 text-xs flex-1 min-w-0 overflow-x-auto" style={{ color: 'var(--text-muted)' }}>
      {ancestors.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
          {i > 0 && <span style={{ color: 'var(--text-faint)' }}>/</span>}
          <button onClick={() => onSelect(crumb)} className="transition-opacity hover:opacity-70 flex items-center gap-1 py-1">
            <span>{crumb.icon || '📄'}</span>
            <span className="whitespace-nowrap">{crumb.title || 'Sans titre'}</span>
          </button>
        </span>
      ))}
      <span style={{ color: 'var(--text-faint)' }} className="flex-shrink-0">/</span>
    </div>
  )
}

export function PageHeader({ page, pages, saving, isMobile, onBack, onTitleChange, onIconChange, onTagsChange, onToggleFavorite, onDelete, onConvertToJournal, onCreatedAtChange, onRestore, onShareUpdate }: {
  page: Page
  pages: Page[]
  saving: boolean
  isMobile: boolean
  onBack: () => void
  onTitleChange: (v: string) => void
  onIconChange: (emoji: string) => void
  onTagsChange: (tags: string[]) => void
  onToggleFavorite: (id: string) => void
  onDelete: () => void
  onConvertToJournal: () => void
  onCreatedAtChange?: (iso: string) => void
  onRestore: (title: string, content: string) => void
  onShareUpdate: (updates: Partial<Page>) => void
}) {
  const [showIconPicker, setShowIconPicker] = useState(false)
  const createdInputRef = useRef<HTMLInputElement>(null)
  const isJournal = page.type === 'journal'
  const allTags = Array.from(new Set(pages.flatMap(p => p.tags || []))).sort()

  function handleCreatedChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value || !onCreatedAtChange) return
    const existing = new Date(page.created_at)
    const [y, m, d] = e.target.value.split('-').map(Number)
    existing.setFullYear(y, m - 1, d)
    onCreatedAtChange(existing.toISOString())
  }

  return (
    <div className="flex-shrink-0">
      {/* Barre supérieure : breadcrumb/retour + actions */}
      <div className="hidden md:flex items-center justify-between px-6 pt-3 pb-1">
        {isJournal ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            ← Journal
          </button>
        ) : (
          <BreadcrumbInline pages={pages} selected={page} onSelect={p => {}} />
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`w-4 h-4 flex items-center justify-center transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </span>
          <ActionsMenu onDelete={onDelete} onConvertToJournal={isJournal ? undefined : onConvertToJournal}>
            <div className="px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              <HistoryButton page={page} onRestore={onRestore} />
            </div>
            <div className="px-3 py-2.5 text-sm border-b"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              <ExportButton page={page} />
            </div>
            <div className="px-3 py-2.5 text-sm border-b"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              <ShareButton page={page as any} onUpdate={onShareUpdate} />
            </div>
          </ActionsMenu>
        </div>
      </div>

      {/* Icône + titre + favori */}
      <div className="px-6 pt-2 pb-1">
        <div className="flex items-start gap-3 group/title">
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowIconPicker(v => !v)}
              className="text-4xl hover:opacity-70 transition-opacity"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {page.icon || (isJournal ? '📝' : '📄')}
            </button>
            {showIconPicker && (
              <div className={isMobile ? 'fixed inset-x-4 top-20 z-50' : 'absolute top-full left-0 z-50'}>
                <EmojiPicker
                  onSelect={emoji => { onIconChange(emoji); setShowIconPicker(false) }}
                  onClose={() => setShowIconPicker(false)}
                />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <input
              className="page-title w-full text-2xl md:text-3xl outline-none bg-transparent"
              style={{ caretColor: 'var(--text-primary)', minHeight: '44px' }}
              value={page.title}
              onChange={e => onTitleChange(e.target.value)}
              placeholder="Sans titre"
            />
            {/* Date de création éditable */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <button
                onClick={() => createdInputRef.current?.showPicker?.() ?? createdInputRef.current?.click()}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
                title="Modifier la date"
              >
                {formatSubtitle(page.created_at)} ✎
              </button>
              <input
                ref={createdInputRef}
                type="date"
                value={page.created_at ? page.created_at.slice(0, 10) : ''}
                onChange={handleCreatedChange}
                className="sr-only"
                tabIndex={-1}
              />
              <PageMetadata page={page} inline />
            </div>
          </div>
          <button
            onClick={() => onToggleFavorite(page.id)}
            className={`flex-shrink-0 mt-2 text-xl transition-all ${page.favorite ? 'opacity-100' : 'opacity-0 group-hover/title:opacity-100 hover:!opacity-100'}`}
            style={{ color: page.favorite ? '#f59e0b' : 'var(--text-faint)' }}
            title={page.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            {page.favorite ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* Tags */}
      <TagsInput tags={page.tags || []} onChange={onTagsChange} allTags={allTags} />
    </div>
  )
}
