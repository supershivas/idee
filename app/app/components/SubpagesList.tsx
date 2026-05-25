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
      <div className={`flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 w-full group transition-shadow hover:shadow-sm ${isDragging ? 'shadow-md' : ''}`}
        style={{ minHeight: '44px' }}>
        {!isMobile && (
          <button {...attributes} {...listeners}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 text-sm">⠿</button>
        )}
        <button onClick={() => onSelect(page)} className="flex items-center gap-2 min-w-0 flex-1 text-left py-2">
          <span className="text-base flex-shrink-0">{page.icon || '📄'}</span>
          <span className="text-sm text-gray-700 truncate">{page.title || 'Sans titre'}</span>
        </button>
        <span className="opacity-0 group-hover:opacity-100 text-gray-400 text-xs flex-shrink-0">→</span>
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
  function handleDragOver(e: DragOverEvent) { } // pas besoin

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return

    const activeIndex = sorted.findIndex(p => p.id === active.id)
    const overIndex = sorted.findIndex(p => p.id === over.id)
    const position = activeIndex < overIndex ? 'after' : 'before'
    onReorder(active.id as string, over.id as string, position)
  }

  // Bouton + partagé
  const addBtn = (
    <button
      onClick={onAddSubpage}
      className="flex-shrink-0 flex items-center gap-2 border border-dashed border-gray-200 hover:border-gray-400 hover:bg-gray-50 rounded-xl px-3 text-gray-400 hover:text-gray-600 transition-colors"
      style={{ minHeight: '44px' }}
    >
      <span className="text-base leading-none">+</span>
      <span className="text-sm whitespace-nowrap">Sous-page</span>
    </button>
  )

  // Pas de sous-pages : carte seule, bien visible, alignée à gauche
  if (sorted.length === 0) {
    return (
      <div className="px-4 md:px-8 pb-4">
        <div style={{ maxWidth: '720px' }}>{addBtn}</div>
      </div>
    )
  }

  // Sous-pages existantes : grille 2 colonnes + bouton + en fin
  const list = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {sorted.map((sub) => (
        <SortableSubpageCard key={sub.id} page={sub} onSelect={onSelect} isMobile={isMobile} />
      ))}
      {addBtn}
    </div>
  )

  return (
    <div className="px-4 md:px-8 pb-3 border-b border-gray-100">
      {isMobile ? list : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map(p => p.id)}>{list}</SortableContext>
          <DragOverlay>
            {activePage && (
              <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2.5 shadow-xl opacity-90">
                <span>{activePage.icon || '📄'}</span>
                <span className="text-sm text-gray-700 truncate">{activePage.title || 'Sans titre'}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
