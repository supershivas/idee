'use client'
import { useState } from 'react'
import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Page } from '../types'

function SortableSubpageCard({ page, onSelect, isMobile, onMoveLeft, onMoveRight, isFirst, isLast }: {
  page: Page, onSelect: (p: Page) => void, isMobile: boolean,
  onMoveLeft: () => void, onMoveRight: () => void, isFirst: boolean, isLast: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex-shrink-0">
      <div className={`flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 group transition-shadow hover:shadow-sm ${isDragging ? 'shadow-md' : ''}`}
        style={{ minHeight: '44px' }}>
        {!isMobile && (
          <button {...attributes} {...listeners}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 text-sm">⠿</button>
        )}
        {isMobile && !isFirst && (
          <button onClick={onMoveLeft} className="text-gray-400 hover:text-gray-700 w-7 h-7 flex items-center justify-center text-xs flex-shrink-0">←</button>
        )}
        {isMobile && isFirst && <div className="w-7" />}
        <button onClick={() => onSelect(page)} className="flex items-center gap-2 min-w-0 flex-1 text-left py-2">
          <span className="text-base flex-shrink-0">{page.icon || '📄'}</span>
          <span className="text-sm text-gray-700 truncate max-w-[120px]">{page.title || 'Sans titre'}</span>
        </button>
        {isMobile && !isLast && (
          <button onClick={onMoveRight} className="text-gray-400 hover:text-gray-700 w-7 h-7 flex items-center justify-center text-xs flex-shrink-0">→</button>
        )}
        {isMobile && isLast && <div className="w-7" />}
        {!isMobile && <span className="opacity-0 group-hover:opacity-100 text-gray-400 text-xs flex-shrink-0">→</span>}
      </div>
    </div>
  )
}

export function SubpagesList({ subpages, onSelect, onReorder, isMobile }: {
  subpages: Page[], onSelect: (p: Page) => void,
  onReorder: (activeId: string, overId: string, position: 'before' | 'after') => void,
  isMobile: boolean
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overPos, setOverPos] = useState<'before' | 'after'>('after')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  if (!subpages.length) return null
  const sorted = [...subpages].sort((a, b) => a.position - b.position)
  const activePage = sorted.find(p => p.id === activeId)

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }
  function handleDragOver(e: DragOverEvent) {
    if (!e.over || e.over.id === e.active.id) return
    const r = e.over?.rect
    if (r && e.activatorEvent) {
      const cx = (e.activatorEvent as PointerEvent).clientX + ((e.delta?.x) || 0)
      setOverPos((cx - r.left) / r.width < 0.5 ? 'before' : 'after')
    }
  }
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return
    onReorder(active.id as string, over.id as string, overPos)
  }
  function moveItem(id: string, dir: 'left' | 'right') {
    const idx = sorted.findIndex(p => p.id === id)
    if (dir === 'left' && idx > 0) onReorder(id, sorted[idx - 1].id, 'before')
    if (dir === 'right' && idx < sorted.length - 1) onReorder(id, sorted[idx + 1].id, 'after')
  }

  const list = (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
        {sorted.map((sub, i) => (
          <SortableSubpageCard key={sub.id} page={sub} onSelect={onSelect} isMobile={isMobile}
            onMoveLeft={() => moveItem(sub.id, 'left')} onMoveRight={() => moveItem(sub.id, 'right')}
            isFirst={i === 0} isLast={i === sorted.length - 1} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="px-4 md:px-8 pb-3 border-b border-gray-100">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Sous-pages</p>
      {isMobile ? list : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map(p => p.id)} strategy={horizontalListSortingStrategy}>{list}</SortableContext>
          <DragOverlay>
            {activePage && (
              <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2.5 shadow-xl opacity-90">
                <span>{activePage.icon || '📄'}</span>
                <span className="text-sm text-gray-700 truncate max-w-[120px]">{activePage.title || 'Sans titre'}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
