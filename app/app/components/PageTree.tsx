'use client'
import { useState, useRef, useEffect } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Page } from '../types'

// ─── SortablePageItem ─────────────────────────────────────────────────────────
export function SortablePageItem({ page, pages, depth, selectedId, onSelect, onAdd, onToggle, isOpen, dropIndicator, isMobile, onRename, onToggleFavorite }: {
  page: Page, pages: Page[], depth: number, selectedId: string | null,
  onSelect: (p: Page) => void, onAdd: (id: string) => void,
  onToggle: (id: string) => void, isOpen: boolean,
  dropIndicator: { position: 'before' | 'after' | 'inside' } | null,
  isMobile: boolean,
  onRename: (id: string, title: string) => void,
  onToggleFavorite: (id: string) => void,
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }
  const hasChildren = pages.some(p => p.parent_id === page.id && !p.deleted_at)
  const isSelected = selectedId === page.id
  const isInside = dropIndicator?.position === 'inside'
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(page.title)
  const renameRef = useRef<HTMLInputElement>(null)
  const dragAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (renaming) renameRef.current?.select() }, [renaming])

  function commitRename() {
    setRenaming(false)
    const trimmed = renameValue.trim()
    if (trimmed !== page.title) onRename(page.id, trimmed)
  }

  // On attache le drag handle à la zone draggable (tout sauf bouton +)
  useEffect(() => {
    if (dragAreaRef.current) setActivatorNodeRef(dragAreaRef.current)
  }, [setActivatorNodeRef])

  return (
    <div ref={setNodeRef} style={style}>

      {/* ── Indicateur BEFORE ── */}
      {dropIndicator?.position === 'before' && (
        <div className="drop-line flex items-center gap-1 my-0.5" style={{ paddingLeft: `${depth * 14 + 14}px`, paddingRight: '8px' }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--drop-indicator)' }} />
          <div className="flex-1 h-0.5 rounded" style={{ background: 'var(--drop-indicator)' }} />
        </div>
      )}

      {/* ── Row ── */}
      <div
        className={`flex items-center gap-1 pr-1 rounded-md group transition-colors
          ${isSelected ? 'sidebar-selected' : 'sidebar-item-hover'}`}
        style={{
          paddingLeft: `${depth * 14 + 6}px`,
          minHeight: isMobile ? '48px' : '32px',
          outline: isInside ? '2px solid var(--drop-indicator)' : undefined,
          outlineOffset: '-1px',
          background: isInside ? 'var(--drop-indicator-bg)' : undefined,
          transition: 'outline 80ms ease, background 80ms ease',
        }}
      >
        {/* Zone draggable : chevron + icône + titre */}
        <div
          ref={dragAreaRef}
          {...attributes}
          {...listeners}
          className="flex items-center gap-1 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
          style={{ minHeight: 'inherit' }}
          onClick={e => {
            // Clic sur le chevron (premiers 16px)
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const x = e.clientX - rect.left
            if (x < 20 && hasChildren) { e.stopPropagation(); onToggle(page.id); return }
            // Clic sur le titre : sélectionner
            if (!renaming) { e.stopPropagation(); onSelect(page) }
          }}
          onDoubleClick={e => { e.stopPropagation(); setRenameValue(page.title); setRenaming(true) }}
        >
          {/* Chevron */}
          <div
            className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-xs"
            style={{ color: 'var(--sidebar-muted)', pointerEvents: 'none' }}
          >
            {hasChildren ? (isOpen ? '▾' : '▸') : ''}
          </div>
          {/* Icône */}
          <span className="text-sm flex-shrink-0" style={{ pointerEvents: 'none' }}>{page.icon || '📄'}</span>
          {/* Titre ou input rename */}
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
              className="flex-1 text-sm outline-none rounded px-1 py-0.5 min-w-0 cursor-text"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--drop-indicator)', color: 'var(--sidebar-fg)' }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              className="flex-1 text-sm truncate py-1 select-none"
              style={{ color: 'var(--sidebar-fg)', pointerEvents: 'none' }}
            >
              {page.title || 'Sans titre'}
            </span>
          )}
        </div>



        {/* Bouton + sous-page */}
        {!renaming && (
          <button
            onClick={e => { e.stopPropagation(); onAdd(page.id) }}
            className="w-6 h-6 flex items-center justify-center rounded text-sm sidebar-icon-btn flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Ajouter une sous-page"
          >+</button>
        )}
      </div>

      {/* ── Indicateur AFTER ── */}
      {dropIndicator?.position === 'after' && (
        <div className="drop-line flex items-center gap-1 my-0.5" style={{ paddingLeft: `${depth * 14 + 14}px`, paddingRight: '8px' }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--drop-indicator)' }} />
          <div className="flex-1 h-0.5 rounded" style={{ background: 'var(--drop-indicator)' }} />
        </div>
      )}
    </div>
  )
}

// ─── PageTree ─────────────────────────────────────────────────────────────────
export function PageTree({ pages, parentId, depth, selectedId, onSelect, onAdd, onToggle, openMap, overId, overPosition, isMobile, onRename, onToggleFavorite }: {
  pages: Page[], parentId: string | null, depth: number, selectedId: string | null,
  onSelect: (p: Page) => void, onAdd: (id: string | null) => void,
  onToggle: (id: string) => void, openMap: Record<string, boolean>,
  overId: string | null, overPosition: 'before' | 'after' | 'inside' | null,
  isMobile: boolean,
  onRename: (id: string, title: string) => void,
  onToggleFavorite: (id: string) => void,
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
            isOpen={!!openMap[page.id]}
            dropIndicator={overId === page.id && overPosition ? { position: overPosition } : null}
            isMobile={isMobile} onRename={onRename}
            onToggleFavorite={onToggleFavorite}
          />
          {openMap[page.id] && (
            <PageTree pages={pages} parentId={page.id} depth={depth + 1}
              selectedId={selectedId} onSelect={onSelect} onAdd={onAdd}
              onToggle={onToggle} openMap={openMap} overId={overId} overPosition={overPosition}
              isMobile={isMobile} onRename={onRename}
              onToggleFavorite={onToggleFavorite} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── SortableFavoriteItem ─────────────────────────────────────────────────────
function SortableFavoriteItem({ page, selectedId, onSelect, onToggleFavorite, isDragOverlay }: {
  page: Page, selectedId: string | null,
  onSelect: (p: Page) => void,
  onToggleFavorite: (id: string) => void,
  isDragOverlay?: boolean,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ ...style, minHeight: '30px', background: isDragOverlay ? 'var(--drag-bg)' : undefined }}
      onClick={() => onSelect(page)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-grab active:cursor-grabbing group transition-colors text-sm
        ${selectedId === page.id ? 'sidebar-selected' : 'sidebar-item-hover'}
        ${isDragOverlay ? 'shadow-lg' : ''}`}
    >
      <span className="flex-shrink-0 text-sm">{page.icon || '📄'}</span>
      <span className="flex-1 truncate text-sm" style={{ color: 'var(--sidebar-fg)' }}>{page.title || 'Sans titre'}</span>
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(page.id) }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-xs flex-shrink-0 transition-opacity sidebar-icon-btn"
        style={{ color: 'var(--accent)' }}
        title="Retirer des favoris"
      >★</button>
    </div>
  )
}

// ─── FavoritesSection ─────────────────────────────────────────────────────────
export function FavoritesSection({ pages, selectedId, onSelect, onToggleFavorite, onReorderFavorites }: {
  pages: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onToggleFavorite: (id: string) => void
  onReorderFavorites: (orderedIds: string[]) => void
}) {
  const favorites = pages
    .filter(p => p.favorite && !p.deleted_at)
    .sort((a, b) => (a.favorite_position ?? 9999) - (b.favorite_position ?? 9999))

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  if (!favorites.length) return null

  const activePage = favorites.find(p => p.id === activeDragId)

  function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = favorites.findIndex(p => p.id === active.id)
    const newIndex = favorites.findIndex(p => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = [...favorites]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    onReorderFavorites(reordered.map(p => p.id))
  }

  return (
    <div className="mb-1">
      <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider select-none" style={{ color: 'var(--sidebar-muted)' }}>Favoris</div>
      <DndContext
        sensors={sensors}
        onDragStart={e => setActiveDragId(e.active.id as string)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <SortableContext items={favorites.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {favorites.map(page => (
            <SortableFavoriteItem key={page.id} page={page} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
          ))}
        </SortableContext>
        <DragOverlay>
          {activePage && <SortableFavoriteItem page={activePage} selectedId={selectedId} onSelect={onSelect} onToggleFavorite={onToggleFavorite} isDragOverlay />}
        </DragOverlay>
      </DndContext>
      <div className="mx-2 mt-1.5 mb-0.5" style={{ borderTop: '1px solid var(--sidebar-border)' }} />
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
    <div className="hidden md:flex items-center gap-1 text-sm px-4 md:px-8 py-1.5 overflow-x-auto" style={{ maxWidth: '720px', color: 'var(--text-muted)' }}>
      {ancestors.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
          {i > 0 && <span style={{ color: 'var(--text-faint)' }}>/</span>}
          <button onClick={() => onSelect(crumb)} className="transition-colors flex items-center gap-1 hover:opacity-80">
            <span>{crumb.icon || '📄'}</span>
            <span className="whitespace-nowrap">{crumb.title || 'Sans titre'}</span>
          </button>
        </span>
      ))}
      <span style={{ color: 'var(--text-faint)' }}>/</span>
    </div>
  )
}
