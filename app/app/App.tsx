'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'
import ShareButton from './ShareButton'
import ExportButton from './ExportButton'
import HistoryButton from './HistoryButton'
import EmojiPicker from './EmojiPicker'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, type DragOverEvent
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, horizontalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type Page = {
  id: string
  parent_id: string | null
  title: string
  content: string
  icon: string
  position: number
  updated_at: string
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

// ─── SearchBar ────────────────────────────────────────────────────────────────
function SearchBar({ pages, onSelect }: { pages: Page[], onSelect: (p: Page) => void }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const results = query.length > 1
    ? pages.filter(p =>
        (p.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (p.content || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []
  return (
    <div className="relative px-2 py-2 border-b border-gray-200">
      <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
        <span className="text-gray-400 text-sm">🔍</span>
        <input value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Rechercher..."
          className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400" />
        {query && <button onClick={() => setQuery('')} className="text-gray-400 w-6 h-6 flex items-center justify-center text-sm">✕</button>}
      </div>
      {focused && results.length > 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-white border rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map(page => (
            <button key={page.id} onClick={() => { onSelect(page); setQuery('') }}
              className="w-full flex items-center gap-2 px-3 py-3 text-left hover:bg-gray-50 border-b last:border-0">
              <span>{page.icon || '📄'}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{page.title || 'Sans titre'}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {focused && query.length > 1 && results.length === 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-white border rounded-lg shadow-xl z-50 p-3">
          <p className="text-sm text-gray-400 text-center">Aucun résultat</p>
        </div>
      )}
    </div>
  )
}

// ─── Item sidebar ─────────────────────────────────────────────────────────────
function SortablePageItem({ page, pages, depth, selectedId, onSelect, onAdd, onToggle, isOpen, overId, overPosition, isMobile }: {
  page: Page, pages: Page[], depth: number, selectedId: string | null,
  onSelect: (p: Page) => void, onAdd: (id: string) => void,
  onToggle: (id: string) => void, isOpen: boolean,
  overId: string | null, overPosition: 'before' | 'after' | 'inside' | null,
  isMobile: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const hasChildren = pages.some(p => p.parent_id === page.id)
  const isSelected = selectedId === page.id
  const isOver = overId === page.id

  return (
    <div ref={setNodeRef} style={style}>
      {isOver && overPosition === 'before' && <div className="h-0.5 bg-blue-400 rounded mx-2 my-0.5" />}
      <div
        className={`flex items-center gap-1 pr-2 rounded-md cursor-pointer group transition-colors
          ${isSelected ? 'bg-gray-200' : 'hover:bg-gray-200/60'}
          ${isOver && overPosition === 'inside' ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 6}px`, minHeight: isMobile ? '48px' : '32px' }}
      >
        {!isMobile && (
          <button {...attributes} {...listeners}
            className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 flex-shrink-0 cursor-grab active:cursor-grabbing">⠿</button>
        )}
        <button onClick={() => onToggle(page.id)}
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0 text-xs">
          {hasChildren ? (isOpen ? '▾' : '▸') : ''}
        </button>
        <span className="text-base flex-shrink-0">{page.icon || '📄'}</span>
        <span onClick={() => onSelect(page)} className="flex-1 text-sm truncate py-1 text-gray-700">
          {page.title || 'Sans titre'}
        </span>
        <button onClick={() => onAdd(page.id)}
          className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-gray-400 hover:text-gray-700 text-base flex-shrink-0 w-9 h-9 flex items-center justify-center`}
          title="Ajouter une sous-page">+</button>
      </div>
      {isOver && overPosition === 'after' && <div className="h-0.5 bg-blue-400 rounded mx-2 my-0.5" />}
    </div>
  )
}

function PageTree({ pages, parentId, depth, selectedId, onSelect, onAdd, onToggle, openMap, overId, overPosition, isMobile }: {
  pages: Page[], parentId: string | null, depth: number, selectedId: string | null,
  onSelect: (p: Page) => void, onAdd: (id: string | null) => void,
  onToggle: (id: string) => void, openMap: Record<string, boolean>,
  overId: string | null, overPosition: 'before' | 'after' | 'inside' | null,
  isMobile: boolean
}) {
  const children = pages.filter(p => p.parent_id === parentId).sort((a, b) => a.position - b.position)
  if (!children.length) return null
  return (
    <div>
      {children.map(page => (
        <div key={page.id}>
          <SortablePageItem page={page} pages={pages} depth={depth} selectedId={selectedId}
            onSelect={onSelect} onAdd={onAdd} onToggle={onToggle}
            isOpen={!!openMap[page.id]} overId={overId} overPosition={overPosition} isMobile={isMobile} />
          {openMap[page.id] && (
            <PageTree pages={pages} parentId={page.id} depth={depth + 1}
              selectedId={selectedId} onSelect={onSelect} onAdd={onAdd}
              onToggle={onToggle} openMap={openMap} overId={overId} overPosition={overPosition} isMobile={isMobile} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Breadcrumb — desktop seulement, sans la page courante ───────────────────
function Breadcrumb({ pages, selected, onSelect }: { pages: Page[], selected: Page | null, onSelect: (p: Page) => void }) {
  if (!selected) return null
  const crumbs: Page[] = []
  let current: Page | undefined = selected
  while (current) {
    crumbs.unshift(current)
    current = pages.find(p => p.id === current!.parent_id)
  }
  // On retire la page courante : inutile de la répéter
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

// ─── Cartes sous-pages ────────────────────────────────────────────────────────
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

function SubpagesList({ subpages, onSelect, onReorder, isMobile }: {
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
          <SortableContext items={sorted.map(p => p.id)} strategy={horizontalListSortingStrategy}>
            {list}
          </SortableContext>
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

// ─── Bottom nav mobile ────────────────────────────────────────────────────────
function MobileBottomNav({ pages, selected, onSelect, onAdd, onShowAll, saving }: {
  pages: Page[], selected: Page | null,
  onSelect: (p: Page) => void, onAdd: () => void,
  onShowAll: () => void, saving: boolean
}) {
  // Pages racines seulement, limitées à 3 pour la nav
  const rootPages = pages.filter(p => p.parent_id === null).sort((a, b) => a.position - b.position)
  const navPages = rootPages.slice(0, 3)
  const hasMore = rootPages.length > 3

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-stretch">
        {/* Pages racines */}
        {navPages.map(page => (
          <button
            key={page.id}
            onClick={() => onSelect(page)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors min-w-0
              ${selected?.id === page.id || (selected && getAncestorIds(pages, selected).includes(page.id))
                ? 'text-gray-900' : 'text-gray-400'}`}
            style={{ minHeight: '56px' }}
          >
            <span className="text-xl leading-none">{page.icon || '📄'}</span>
            <span className="text-[10px] truncate w-full text-center px-1 leading-tight">
              {page.title || 'Sans titre'}
            </span>
          </button>
        ))}

        {/* Bouton "toutes les pages" si plus de 3 */}
        {hasMore && (
          <button onClick={onShowAll}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-gray-400"
            style={{ minHeight: '56px' }}>
            <span className="text-xl leading-none">☰</span>
            <span className="text-[10px]">Pages</span>
          </button>
        )}

        {/* Séparateur */}
        <div className="w-px bg-gray-100 my-2" />

        {/* Nouvelle page */}
        <button onClick={onAdd}
          className="flex-none flex flex-col items-center justify-center gap-0.5 px-4 py-2 text-gray-400 hover:text-gray-700"
          style={{ minHeight: '56px' }}>
          <span className="text-xl leading-none">＋</span>
          <span className="text-[10px]">Nouveau</span>
        </button>
      </div>
    </div>
  )
}

function getAncestorIds(pages: Page[], page: Page): string[] {
  const ids: string[] = []
  let current: Page | undefined = pages.find(p => p.id === page.parent_id)
  while (current) {
    ids.push(current.id)
    current = pages.find(p => p.id === current!.parent_id)
  }
  return ids
}

// ─── Drawer "toutes les pages" mobile ────────────────────────────────────────
function MobilePageDrawer({ pages, selected, onSelect, onAdd, onClose, openMap, onToggle, overId, overPosition, sensors, onDragStart, onDragOver, onDragEnd, activePage }: {
  pages: Page[], selected: Page | null,
  onSelect: (p: Page) => void, onAdd: (id: string | null) => void,
  onClose: () => void, openMap: Record<string, boolean>, onToggle: (id: string) => void,
  overId: string | null, overPosition: 'before' | 'after' | 'inside' | null,
  sensors: any, onDragStart: any, onDragOver: any, onDragEnd: any, activePage: Page | undefined
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <span className="font-semibold text-gray-800">Pages</span>
          <button onClick={() => onAdd(null)}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-xl">+</button>
        </div>
        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
          <SearchBar pages={pages} onSelect={(p) => { onSelect(p); onClose() }} />
        </div>
        {/* Liste */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
            <PageTree pages={pages} parentId={null} depth={0} selectedId={selected?.id || null}
              onSelect={(p) => { onSelect(p); onClose() }}
              onAdd={onAdd} onToggle={onToggle} openMap={openMap}
              overId={overId} overPosition={overPosition} isMobile={true} />
            <DragOverlay>
              {activePage && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-lg text-sm opacity-90">
                  <span>{activePage.icon}</span>
                  <span className="truncate max-w-32">{activePage.title || 'Sans titre'}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} className="flex-shrink-0" />
      </div>
    </div>
  )
}

// ─── Menu actions "…" ─────────────────────────────────────────────────────────
function ActionsMenu({ onDelete, children }: { onDelete: () => void, children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-lg"
        title="Plus d'actions">···</button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-48 overflow-hidden">
          {children}
          <div className="border-t border-gray-100" />
          <button onClick={() => { onDelete(); setOpen(false) }}
            className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50">Supprimer la page</button>
        </div>
      )}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App({ initialPages, userId }: { initialPages: Page[], userId: string }) {
  const [pages, setPages] = useState<Page[]>(initialPages)
  const [selected, setSelected] = useState<Page | null>(null)
  const [saving, setSaving] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overPosition, setOverPosition] = useState<'before' | 'after' | 'inside' | null>(null)
  const lastSaveRef = useRef(0)
  const isMobile = useIsMobile()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function toggleOpen(id: string) { setOpenMap(o => ({ ...o, [id]: !o[id] })) }

  async function addPage(parentId: string | null) {
    const supabase = createClient()
    const icons = ['📄', '📝', '💡', '🗂️', '📌', '🔖', '⭐', '🚀', '🎯', '💬']
    const icon = icons[Math.floor(Math.random() * icons.length)]
    const { data } = await supabase
      .from('pages')
      .insert({ title: 'Sans titre', content: '', user_id: userId, parent_id: parentId, position: pages.length, icon })
      .select().single()
    if (data) {
      setPages(prev => [...prev, data])
      setSelected(data)
      setShowDrawer(false)
      if (parentId) setOpenMap(o => ({ ...o, [parentId]: true }))
    }
  }

  async function updateTitle(value: string) {
    if (!selected) return
    const updated = { ...selected, title: value, updated_at: new Date().toISOString() }
    setSelected(updated)
    setPages(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSaving(true)
    const supabase = createClient()
    await supabase.from('pages').update({ title: value, updated_at: updated.updated_at }).eq('id', selected.id)
    setSaving(false)
  }

  async function updateIcon(id: string, icon: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, icon } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, icon } : null)
    const supabase = createClient()
    await supabase.from('pages').update({ icon }).eq('id', id)
  }

  async function updateContent(content: string) {
    if (!selected) return
    const updated = { ...selected, content, updated_at: new Date().toISOString() }
    setSelected(prev => prev ? { ...prev, content } : null)
    setPages(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSaving(true)
    const supabase = createClient()
    await supabase.from('pages').update({ content, updated_at: updated.updated_at }).eq('id', selected.id)
    const now = Date.now()
    if (now - lastSaveRef.current > 2 * 60 * 1000) {
      lastSaveRef.current = now
      await supabase.from('page_history').insert({ page_id: selected.id, user_id: userId, title: selected.title, content })
    }
    setSaving(false)
  }

  async function deletePage(id: string) {
    const supabase = createClient()
    await supabase.from('pages').delete().eq('id', id)
    const remaining = pages.filter(p => p.id !== id && p.parent_id !== id)
    setPages(remaining)
    setSelected(remaining[0] || null)
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const reorderSiblings = useCallback(async (
    activeId: string, targetId: string, position: 'before' | 'after' | 'inside'
  ) => {
    const dragged = pages.find(p => p.id === activeId)
    const target = pages.find(p => p.id === targetId)
    if (!dragged || !target) return
    let check: Page | undefined = target
    while (check) {
      if (check.id === activeId) return
      check = pages.find(p => p.id === check!.parent_id)
    }
    const newParentId = position === 'inside' ? targetId : target.parent_id
    const siblings = pages.filter(p => p.parent_id === newParentId && p.id !== activeId).sort((a, b) => a.position - b.position)
    const targetIndex = siblings.findIndex(p => p.id === targetId)
    const insertAt = position === 'before' ? targetIndex : position === 'after' ? targetIndex + 1 : siblings.length
    siblings.splice(insertAt, 0, { ...dragged, parent_id: newParentId })
    const updates = siblings.map((p, i) => ({ id: p.id, position: i, parent_id: newParentId }))
    setPages(prev => prev.map(p => {
      const u = updates.find(u => u.id === p.id)
      return u ? { ...p, position: u.position, parent_id: u.parent_id as string | null } : p
    }))
    if (position === 'inside') setOpenMap(o => ({ ...o, [targetId]: true }))
    const supabase = createClient()
    await Promise.all(updates.map(u => supabase.from('pages').update({ position: u.position, parent_id: u.parent_id }).eq('id', u.id)))
  }, [pages])

  function handleDragStart(e: DragStartEvent) { setActiveDragId(e.active.id as string) }
  function handleDragOver(e: DragOverEvent) {
    const { over, active } = e
    if (!over || over.id === active.id) { setOverId(null); return }
    setOverId(over.id as string)
    const r = e.over?.rect
    if (r && e.activatorEvent) {
      const cy = (e.activatorEvent as PointerEvent).clientY + ((e.delta?.y) || 0)
      const ratio = (cy - r.top) / r.height
      setOverPosition(ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside')
    }
  }
  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveDragId(null); setOverId(null); setOverPosition(null)
    if (!over || active.id === over.id) return
    await reorderSiblings(active.id as string, over.id as string, overPosition || 'after')
  }
  async function handleSubpageReorder(activeId: string, overId: string, position: 'before' | 'after') {
    await reorderSiblings(activeId, overId, position)
  }

  const activePage = pages.find(p => p.id === activeDragId)
  const subpages = selected ? pages.filter(p => p.parent_id === selected.id).sort((a, b) => a.position - b.position) : []

  // Sidebar desktop
  const desktopSidebar = (
    <div className="hidden md:flex flex-col border-r flex-shrink-0 bg-gray-50" style={{ width: '240px' }}>
      <div className="px-4 flex items-center justify-between border-b border-gray-200" style={{ minHeight: '52px' }}>
        <span className="font-semibold text-gray-800 text-sm">Idée</span>
        <div className="flex items-center gap-1">
          <button onClick={() => addPage(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 text-xl" title="Nouvelle page">+</button>
          <button onClick={logout} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400" title="Se déconnecter">⎋</button>
        </div>
      </div>
      <SearchBar pages={pages} onSelect={setSelected} />
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {pages.filter(p => p.parent_id === null).length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-3">Clique sur + pour créer une page.</p>
        )}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <PageTree pages={pages} parentId={null} depth={0} selectedId={selected?.id || null}
            onSelect={setSelected} onAdd={addPage} onToggle={toggleOpen} openMap={openMap}
            overId={overId} overPosition={overPosition} isMobile={false} />
          <DragOverlay>
            {activePage && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-lg text-sm opacity-90">
                <span>⠿</span><span>{activePage.icon}</span>
                <span className="truncate max-w-32">{activePage.title || 'Sans titre'}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )

  return (
    <div className="flex w-full h-screen bg-white overflow-hidden">
      {desktopSidebar}

      {/* Drawer mobile (bottom sheet) */}
      {showDrawer && (
        <MobilePageDrawer
          pages={pages} selected={selected}
          onSelect={setSelected} onAdd={addPage}
          onClose={() => setShowDrawer(false)}
          openMap={openMap} onToggle={toggleOpen}
          overId={overId} overPosition={overPosition}
          sensors={sensors} onDragStart={handleDragStart}
          onDragOver={handleDragOver} onDragEnd={handleDragEnd}
          activePage={activePage}
        />
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0"
        style={{ paddingBottom: isMobile ? '56px' : '0' }}>

        {selected ? (
          <>
            {/* Breadcrumb — desktop uniquement, sans la page courante */}
            <Breadcrumb pages={pages} selected={selected} onSelect={setSelected} />

            {/* Header : icône + titre + actions (une seule fois) */}
            <div className="px-4 md:px-8 pt-5 pb-2">
              <div className="flex items-start gap-3">
                {/* Icône */}
                <div className="relative flex-shrink-0">
                  <button onClick={() => setShowIconPicker(v => !v)}
                    className="text-4xl hover:opacity-70 transition-opacity"
                    style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selected.icon || '📄'}
                  </button>
                  {showIconPicker && (
                    <div className={isMobile ? 'fixed inset-x-4 top-20 z-50' : 'absolute top-full left-0 z-50'}>
                      <EmojiPicker
                        onSelect={(emoji) => { updateIcon(selected.id, emoji); setShowIconPicker(false) }}
                        onClose={() => setShowIconPicker(false)}
                      />
                    </div>
                  )}
                </div>

                {/* Titre */}
                <input
                  className="flex-1 text-2xl md:text-3xl font-bold outline-none bg-transparent text-gray-900 placeholder-gray-300 min-w-0 pt-1"
                  style={{ minHeight: '44px' }}
                  value={selected.title}
                  onChange={e => updateTitle(e.target.value)}
                  placeholder="Sans titre"
                />

                {/* Actions desktop */}
                <div className="hidden md:flex items-center gap-1 flex-shrink-0 pt-1">
                  {saving && <span className="text-xs text-gray-400">Sauvegarde...</span>}
                  <HistoryButton page={selected} onRestore={(title, content) => {
                    setSelected(prev => prev ? { ...prev, title, content } : null)
                    setPages(prev => prev.map(p => p.id === selected.id ? { ...p, title, content } : p))
                  }} />
                  <ExportButton page={selected} />
                  <ShareButton page={selected as any} onUpdate={(updates) => {
                    setSelected(prev => prev ? { ...prev, ...updates } : null)
                    setPages(prev => prev.map(p => p.id === selected.id ? { ...p, ...updates } : p))
                  }} />
                  <button onClick={() => deletePage(selected.id)} className="text-sm text-red-400 hover:text-red-500 px-2">Supprimer</button>
                </div>

                {/* Actions mobile — menu ··· */}
                <div className="md:hidden flex-shrink-0 pt-1">
                  <ActionsMenu onDelete={() => deletePage(selected.id)}>
                    <div className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                      <ExportButton page={selected} />
                    </div>
                    <div className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                      <ShareButton page={selected as any} onUpdate={(updates) => {
                        setSelected(prev => prev ? { ...prev, ...updates } : null)
                        setPages(prev => prev.map(p => p.id === selected.id ? { ...p, ...updates } : p))
                      }} />
                    </div>
                    <div className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100">
                      <HistoryButton page={selected} onRestore={(title, content) => {
                        setSelected(prev => prev ? { ...prev, title, content } : null)
                        setPages(prev => prev.map(p => p.id === selected.id ? { ...p, title, content } : p))
                      }} />
                    </div>
                  </ActionsMenu>
                </div>
              </div>
              {/* Indicateur sauvegarde mobile */}
              {saving && isMobile && <p className="text-xs text-gray-400 mt-1">Sauvegarde…</p>}
            </div>

            <SubpagesList subpages={subpages} onSelect={setSelected} onReorder={handleSubpageReorder} isMobile={isMobile} />

            <Editor key={selected.id} page={selected} pages={pages}
              onUpdate={updateContent} onAddSubpage={() => addPage(selected.id)}
              onNavigate={setSelected} userId={userId} isMobile={isMobile} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-4xl mb-3">💡</p>
              <p className="text-lg font-medium mb-1 text-gray-500">Aucune page sélectionnée</p>
              <button onClick={() => addPage(null)} className="text-sm text-blue-500 hover:text-blue-700 underline">Créer une page</button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav mobile */}
      <MobileBottomNav
        pages={pages} selected={selected}
        onSelect={setSelected} onAdd={() => addPage(null)}
        onShowAll={() => setShowDrawer(true)} saving={saving}
      />
    </div>
  )
}
