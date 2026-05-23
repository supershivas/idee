'use client'
import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Page, colorBg, PAGE_COLORS } from '../types'

// ─── ColorPicker ──────────────────────────────────────────────────────────────
function ColorDot({ color, onSelect }: { color: string, onSelect: () => void }) {
  const c = PAGE_COLORS.find(p => p.value === color)
  return (
    <button onClick={onSelect} title={c?.name}
      className={`w-4 h-4 rounded-full flex-shrink-0 border-2 border-transparent hover:border-gray-400 transition-all ${c?.dot || 'bg-gray-300'}`} />
  )
}

// ─── SortablePageItem ─────────────────────────────────────────────────────────
export function SortablePageItem({ page, pages, depth, selectedId, onSelect, onAdd, onToggle, isOpen, overId, overPosition, isMobile, onRename, onColorChange }: {
  page: Page, pages: Page[], depth: number, selectedId: string | null,
  onSelect: (p: Page) => void, onAdd: (id: string) => void,
  onToggle: (id: string) => void, isOpen: boolean,
  overId: string | null, overPosition: 'before' | 'after' | 'inside' | null,
  isMobile: boolean,
  onRename: (id: string, title: string) => void,
  onColorChange: (id: string, color: string) => void,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const hasChildren = pages.some(p => p.parent_id === page.id && !p.deleted_at)
  const isSelected = selectedId === page.id
  const isOver = overId === page.id
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(page.title)
  const [showColors, setShowColors] = useState(false)
  const renameRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLDivElement>(null)

  // Focus l'input de renommage quand il s'ouvre
  useEffect(() => { if (renaming) renameRef.current?.select() }, [renaming])

  // Ferme le color picker en cliquant ailleurs
  useEffect(() => {
    if (!showColors) return
    function handler(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setShowColors(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColors])

  function commitRename() {
    setRenaming(false)
    const trimmed = renameValue.trim()
    if (trimmed !== page.title) onRename(page.id, trimmed)
  }

  const colorDot = page.color
    ? PAGE_COLORS.find(c => c.value === page.color)
    : null

  return (
    <div ref={setNodeRef} style={style}>
      {isOver && overPosition === 'before' && <div className="h-0.5 bg-blue-400 rounded mx-2 my-0.5" />}
      <div
        className={`flex items-center gap-1 pr-1 rounded-md cursor-pointer group transition-colors
          ${isSelected ? 'bg-gray-200' : 'hover:bg-gray-200/60'}
          ${isOver && overPosition === 'inside' ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 6}px`, minHeight: isMobile ? '48px' : '32px' }}
      >
        {/* Poignée drag desktop */}
        {!isMobile && (
          <button {...attributes} {...listeners}
            className="w-4 h-full flex items-center justify-center text-gray-300 hover:text-gray-500 flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100">
            ⠿
          </button>
        )}

        {/* Toggle enfants */}
        <button onClick={() => onToggle(page.id)}
          className="w-4 h-4 flex items-center justify-center text-gray-400 flex-shrink-0 text-xs">
          {hasChildren ? (isOpen ? '▾' : '▸') : ''}
        </button>

        {/* Point couleur */}
        {colorDot && (
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colorDot.dot}`} />
        )}

        {/* Icône */}
        <span className="text-sm flex-shrink-0">{page.icon || '📄'}</span>

        {/* Titre — renommage inline sur double-clic */}
        {renaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setRenameValue(page.title); setRenaming(false) }
              e.stopPropagation()
            }}
            className="flex-1 text-sm outline-none bg-white border border-blue-300 rounded px-1 py-0.5 min-w-0"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            onClick={() => onSelect(page)}
            onDoubleClick={() => { setRenameValue(page.title); setRenaming(true) }}
            className="flex-1 text-sm truncate py-1 text-gray-700 select-none"
            title={isMobile ? undefined : 'Double-clic pour renommer'}>
            {page.title || 'Sans titre'}
          </span>
        )}

        {/* Actions hover */}
        {!renaming && (
          <div className={`flex items-center gap-0.5 flex-shrink-0 ${isMobile ? '' : 'opacity-0 group-hover:opacity-100'}`}>
            {/* Color picker */}
            <div className="relative" ref={colorRef}>
              <button
                onClick={e => { e.stopPropagation(); setShowColors(v => !v) }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 text-xs"
                title="Couleur">
                {page.color
                  ? <div className={`w-2.5 h-2.5 rounded-full ${PAGE_COLORS.find(c => c.value === page.color)?.dot}`} />
                  : '●'}
              </button>
              {showColors && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-[100] flex gap-1.5 flex-wrap w-36">
                  {PAGE_COLORS.map(c => (
                    <button key={c.value} onClick={() => { onColorChange(page.id, c.value); setShowColors(false) }}
                      title={c.name}
                      className={`w-5 h-5 rounded-full border-2 transition-all
                        ${page.color === c.value ? 'border-gray-500 scale-110' : 'border-transparent hover:border-gray-300'}
                        ${c.dot}`} />
                  ))}
                </div>
              )}
            </div>
            {/* Nouvelle sous-page */}
            <button onClick={() => onAdd(page.id)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 text-sm"
              title="Ajouter une sous-page">+</button>
          </div>
        )}
      </div>
      {isOver && overPosition === 'after' && <div className="h-0.5 bg-blue-400 rounded mx-2 my-0.5" />}
    </div>
  )
}

// ─── PageTree ─────────────────────────────────────────────────────────────────
export function PageTree({ pages, parentId, depth, selectedId, onSelect, onAdd, onToggle, openMap, overId, overPosition, isMobile, onRename, onColorChange }: {
  pages: Page[], parentId: string | null, depth: number, selectedId: string | null,
  onSelect: (p: Page) => void, onAdd: (id: string | null) => void,
  onToggle: (id: string) => void, openMap: Record<string, boolean>,
  overId: string | null, overPosition: 'before' | 'after' | 'inside' | null,
  isMobile: boolean,
  onRename: (id: string, title: string) => void,
  onColorChange: (id: string, color: string) => void,
}) {
  const children = pages
    .filter(p => p.parent_id === parentId && !p.deleted_at)
    .sort((a, b) => a.position - b.position)

  if (!children.length) return null
  return (
    <div>
      {children.map(page => (
        <div key={page.id}>
          <SortablePageItem
            page={page} pages={pages} depth={depth} selectedId={selectedId}
            onSelect={onSelect} onAdd={onAdd} onToggle={onToggle}
            isOpen={!!openMap[page.id]} overId={overId} overPosition={overPosition}
            isMobile={isMobile} onRename={onRename} onColorChange={onColorChange}
          />
          {openMap[page.id] && (
            <PageTree pages={pages} parentId={page.id} depth={depth + 1}
              selectedId={selectedId} onSelect={onSelect} onAdd={onAdd}
              onToggle={onToggle} openMap={openMap} overId={overId} overPosition={overPosition}
              isMobile={isMobile} onRename={onRename} onColorChange={onColorChange} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
export function Breadcrumb({ pages, selected, onSelect }: {
  pages: Page[], selected: Page | null, onSelect: (p: Page) => void
}) {
  if (!selected) return null
  const crumbs: Page[] = []
  let current: Page | undefined = selected
  while (current) {
    crumbs.unshift(current)
    current = pages.find(p => p.id === current!.parent_id)
  }
  const ancestors = crumbs.slice(0, -1)
  if (ancestors.length === 0) return null
  return (
    <div className="hidden md:flex items-center gap-1 text-sm text-gray-400 px-4 md:px-8 py-1.5 overflow-x-auto">
      {ancestors.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
          {i > 0 && <span className="text-gray-300">/</span>}
          <button onClick={() => onSelect(crumb)} className="hover:text-gray-700 transition-colors flex items-center gap-1">
            <span>{crumb.icon || '📄'}</span>
            <span className="whitespace-nowrap">{crumb.title || 'Sans titre'}</span>
          </button>
        </span>
      ))}
      <span className="text-gray-300">/</span>
    </div>
  )
}
