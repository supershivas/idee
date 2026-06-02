'use client'
import { useState } from 'react'
import { useSortable, SortableContext } from '@dnd-kit/sortable'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Page } from '../types'

function SortableSubpageCard({ page, onSelect, isMobile }: {
  page: Page, onSelect: (p: Page) => void, isMobile: boolean,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-xl px-3 w-full group transition-shadow ${isDragging ? 'shadow-md' : 'hover:shadow-sm'}`}
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          minHeight: '44px',
        }}>
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
        <span className="opacity-0 group-hover:opacity-100 text-xs flex-shrink-0 transition-opacity" style={{ color: 'var(--text-muted)' }}>→</span>
      </div>
    </div>
  )
}

export function SubpagesList({ subpages, onSelect, onReorder, isMobile, onAddSubpage }: {
  subpages: Page[], onSelect: (p: Page) => void,
  onReorder: (activeId: string, overId: string, position: 'before' | 'after') => void,
  isMobile: boolean,
  onAddSubpage: () => void,
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const sorted = [...subpages].sort((a, b) => a.position - b.position)
  const activePage = sorted.find(p => p.id === activeId)

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }
  function handleDragOver(e: DragOverEvent) {}
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return
    const activeIndex = sorted.findIndex(p => p.id === active.id)
    const overIndex = sorted.findIndex(p => p.id === over.id)
    const position = activeIndex < overIndex ? 'after' : 'before'
    onReorder(active.id as string, over.id as string, position)
  }

  const addBtn = (
    <button
      onClick={onAddSubpage}
      className="flex-shrink-0 flex items-center gap-2 rounded-xl px-3 transition-colors"
      style={{
        minHeight: '44px',
        border: '1px dashed var(--border)',
        color: 'var(--text-muted)',
      }}
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

  if (sorted.length === 0) {
    return (
      <div className="px-4 md:px-8 pb-4">
        <div style={{ maxWidth: '720px' }}>{addBtn}</div>
      </div>
    )
  }

  const list = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {sorted.map((sub) => (
        <SortableSubpageCard key={sub.id} page={sub} onSelect={onSelect} isMobile={isMobile} />
      ))}
      {addBtn}
    </div>
  )

  return (
    <div className="px-4 md:px-8 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
      {isMobile ? list : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map(p => p.id)}>{list}</SortableContext>
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
