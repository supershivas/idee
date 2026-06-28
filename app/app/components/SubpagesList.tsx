'use client'
import { useState } from 'react'
import { useSortable, SortableContext } from '@dnd-kit/sortable'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Page, formatSubtitle } from '../types'

// ── Hub detection ─────────────────────────────────────────────────────────────
function detectHub(page: Page, subpages: Page[], journalSubpages: Page[]): boolean {
  if (subpages.length === 0 && journalSubpages.length === 0) return false
  const text = (page.content || '').replace(/<[^>]*>/g, '').replace(/\s/g, '').trim()
  return text.length === 0
}

// ── Hub card (large, prominent) ───────────────────────────────────────────────
function SortableHubCard({ page, onSelect, isMobile }: {
  page: Page; onSelect: (p: Page) => void; isMobile: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {!isMobile && (
        <button {...attributes} {...listeners}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded cursor-grab active:cursor-grabbing opacity-0 group-hover/hub:opacity-100 transition-opacity"
          style={{ color: 'var(--text-faint)' }}>⠿</button>
      )}
      <button
        onClick={() => onSelect(page)}
        className="group/hub w-full flex flex-col gap-2 rounded-2xl p-4 text-left transition-all"
        style={{
          background: 'var(--hover-bg)',
          border: '1px solid var(--border)',
          minHeight: '88px',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'
          e.currentTarget.style.borderColor = 'var(--text-faint)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
      >
        <span className="text-3xl leading-none">{page.icon || '📄'}</span>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {page.title || 'Sans titre'}
          </span>
          <span className="text-xs flex-shrink-0 opacity-0 group-hover/hub:opacity-60 transition-opacity"
            style={{ color: 'var(--text-muted)' }}>→</span>
        </div>
      </button>
    </div>
  )
}

// ── Journal hub card ──────────────────────────────────────────────────────────
function JournalHubCard({ page, onSelect }: { page: Page; onSelect: (p: Page) => void }) {
  return (
    <button
      onClick={() => onSelect(page)}
      className="group/hub w-full flex flex-col gap-1.5 rounded-2xl p-4 text-left transition-all"
      style={{
        background: 'var(--hover-bg)',
        border: '1px solid var(--border)',
        minHeight: '88px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'
        e.currentTarget.style.borderColor = 'var(--text-faint)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <span className="text-3xl leading-none">{page.icon || '📝'}</span>
      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {page.title || 'Sans titre'}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {formatSubtitle(page.created_at)}
      </span>
    </button>
  )
}

// ── Compact card (existing behaviour) ────────────────────────────────────────
function SortableSubpageCard({ page, onSelect, isMobile }: {
  page: Page; onSelect: (p: Page) => void; isMobile: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-xl px-3 w-full group transition-shadow ${isDragging ? 'shadow-md' : 'hover:shadow-sm'}`}
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', minHeight: '44px' }}>
        {!isMobile && (
          <button {...attributes} {...listeners}
            className="cursor-grab active:cursor-grabbing flex-shrink-0 text-sm transition-colors"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}>⠿</button>
        )}
        <button onClick={() => onSelect(page)} className="flex items-center gap-2 min-w-0 flex-1 text-left py-2">
          <span className="text-base flex-shrink-0">{page.icon || '📄'}</span>
          <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{page.title || 'Sans titre'}</span>
        </button>
        <span className="opacity-0 group-hover:opacity-100 text-xs flex-shrink-0 transition-opacity"
          style={{ color: 'var(--text-muted)' }}>→</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function SubpagesList({ page, subpages, journalSubpages = [], onSelect, onReorder, isMobile, onAddSubpage }: {
  page: Page
  subpages: Page[]
  journalSubpages?: Page[]
  onSelect: (p: Page) => void
  onReorder: (activeId: string, overId: string, position: 'before' | 'after') => void
  isMobile: boolean
  onAddSubpage: () => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const sorted = [...subpages].sort((a, b) => a.position - b.position)
  const sortedJournal = [...journalSubpages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const activePage = sorted.find(p => p.id === activeId)
  const hub = detectHub(page, subpages, journalSubpages)

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }
  function handleDragOver(_e: DragOverEvent) {}
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return
    const activeIndex = sorted.findIndex(p => p.id === active.id)
    const overIndex = sorted.findIndex(p => p.id === over.id)
    onReorder(active.id as string, over.id as string, activeIndex < overIndex ? 'after' : 'before')
  }

  // ── Hub add button ──
  const hubAddBtn = (
    <button
      onClick={onAddSubpage}
      className="flex flex-col gap-2 rounded-2xl p-4 text-left transition-all"
      style={{
        minHeight: '88px',
        border: '1px dashed var(--border)',
        color: 'var(--text-muted)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--text-muted)'
        e.currentTarget.style.background = 'var(--hover-bg)'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-muted)'
      }}
    >
      <span className="text-3xl leading-none opacity-40">+</span>
      <span className="text-sm">Nouvelle sous-page</span>
    </button>
  )

  // ── Compact add button ──
  const compactAddBtn = (
    <button
      onClick={onAddSubpage}
      className="flex-shrink-0 flex items-center gap-2 rounded-xl px-5 transition-colors"
      style={{ minHeight: '52px', paddingTop: '12px', paddingBottom: '12px', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--text-muted)'
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.background = 'var(--hover-bg)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color = 'var(--text-muted)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span className="text-base leading-none">+</span>
      <span className="text-sm whitespace-nowrap">Sous-page</span>
    </button>
  )

  // ── Hub mode ──────────────────────────────────────────────────────────────
  if (hub) {
    const hubGrid = (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {sorted.map(sub => (
          <SortableHubCard key={sub.id} page={sub} onSelect={onSelect} isMobile={isMobile} />
        ))}
        {sortedJournal.map(entry => (
          <JournalHubCard key={entry.id} page={entry} onSelect={onSelect} />
        ))}
        {hubAddBtn}
      </div>
    )

    return (
      <div className="px-6 pt-4 pb-6">
        {isMobile ? hubGrid : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map(p => p.id)}>{hubGrid}</SortableContext>
            <DragOverlay>
              {activePage && (
                <div className="flex flex-col gap-2 rounded-2xl p-4 shadow-xl opacity-90"
                  style={{ background: 'var(--drag-bg)', border: '1px solid var(--drag-border)', minHeight: '88px' }}>
                  <span className="text-3xl leading-none">{activePage.icon || '📄'}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{activePage.title || 'Sans titre'}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    )
  }

  // ── Compact mode (note with subpages) ─────────────────────────────────────
  if (sorted.length === 0) {
    return (
      <div className="px-6 pb-4 mt-4">
        {compactAddBtn}
      </div>
    )
  }

  const compactGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {sorted.map(sub => (
        <SortableSubpageCard key={sub.id} page={sub} onSelect={onSelect} isMobile={isMobile} />
      ))}
      {compactAddBtn}
    </div>
  )

  return (
    <div className="px-6 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
      {isMobile ? compactGrid : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map(p => p.id)}>{compactGrid}</SortableContext>
          <DragOverlay>
            {activePage && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 shadow-xl opacity-90"
                style={{ background: 'var(--drag-bg)', border: '1px solid var(--drag-border)' }}>
                <span>{activePage.icon || '📄'}</span>
                <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{activePage.title || 'Sans titre'}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
