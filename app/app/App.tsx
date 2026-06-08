'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'
import ShareButton from './ShareButton'
import ExportButton from './ExportButton'
import HistoryButton from './HistoryButton'
import EmojiPicker from './EmojiPicker'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { Page, formatSubtitle } from './types'
import { useIsMobile, useToggleFavorite, useReorderFavorites } from './hooks'
import { SearchBar } from './components/SearchBar'
import { TrashPanel } from './components/TrashPanel'
import { PageTree, Breadcrumb, FavoritesSection } from './components/PageTree'
import { SubpagesList } from './components/SubpagesList'
import { MobileHomeView, MobileTopBar } from './components/MobileNav'
import { ActionsMenu, ConfirmTrashModal } from './components/ActionsMenu'
import { JournalList, JournalEntryHeader } from './components/JournalView'
import { SettingsPanel, useTheme } from './components/SettingsPanel'
import { TagsView, TagsInput } from './components/TagsView'

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

function PageActionBtn({ children, title, onClick }: { children: React.ReactNode, title: string, onClick: () => void }) {
  return (
    <div className="[&_button]:!text-xs [&_button]:!px-1.5 [&_button]:!py-1 [&_button]:!rounded [&_button]:transition-colors" title={title}
      style={{ ['--tw-text-opacity' as any]: 1 }}>
      {children}
    </div>
  )
}

export type { Page }
const lastPageKey = (userId: string) => `idee_last_page_${userId}`

function getAncestorIds(pages: Page[], pageId: string): string[] {
  const ids: string[] = []
  let current = pages.find(p => p.id === pageId)
  while (current?.parent_id) {
    ids.push(current.parent_id)
    current = pages.find(p => p.id === current!.parent_id)
  }
  return ids
}

function PageDates({ page, onCreatedAtChange, onUpdatedAtChange }: {
  page: Page
  onCreatedAtChange: (iso: string) => void
  onUpdatedAtChange: (iso: string) => void
}) {
  const createdRef = useRef<HTMLInputElement>(null)
  const updatedRef = useRef<HTMLInputElement>(null)

  function handleChange(ref: React.RefObject<HTMLInputElement>, current: string, cb: (iso: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.value) return
      const existing = new Date(current)
      const [y, m, d] = e.target.value.split("-").map(Number)
      existing.setFullYear(y, m - 1, d)
      cb(existing.toISOString())
    }
  }

  return (
    <div className="flex flex-col gap-0.5 mt-1 mb-1">
      <div className="flex items-center gap-1">
        <span className="text-xs w-20 flex-shrink-0" style={{ color: "var(--text-faint)" }}>Créé le</span>
        <button onClick={() => createdRef.current?.showPicker?.() ?? createdRef.current?.click()}
          className="text-xs transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
          {formatSubtitle(page.created_at)} ✎
        </button>
        <input ref={createdRef} type="date" value={page.created_at?.slice(0, 10) || ""}
          onChange={handleChange(createdRef, page.created_at, onCreatedAtChange)} className="sr-only" tabIndex={-1} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs w-20 flex-shrink-0" style={{ color: "var(--text-faint)" }}>Modifié le</span>
        <button onClick={() => updatedRef.current?.showPicker?.() ?? updatedRef.current?.click()}
          className="text-xs transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
          {formatSubtitle(page.updated_at)} ✎
        </button>
        <input ref={updatedRef} type="date" value={page.updated_at?.slice(0, 10) || ""}
          onChange={handleChange(updatedRef, page.updated_at, onUpdatedAtChange)} className="sr-only" tabIndex={-1} />
      </div>
    </div>
  )
}

const SIDEBAR_JOURNAL_PAGE = 30

function SidebarJournalList({ entries, selectedId, onSelect }: {
  entries: Page[], selectedId: string | null, onSelect: (p: Page) => void
}) {
  const [limit, setLimit] = useState(SIDEBAR_JOURNAL_PAGE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const sorted = [...entries].sort((a, b) =>
    new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
  )
  const visible = sorted.slice(0, limit)
  const hasMore = sorted.length > limit

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setLimit(l => l + SIDEBAR_JOURNAL_PAGE)
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [hasMore])

  if (entries.length === 0) return (
    <p className="text-xs px-3 py-3" style={{ color: 'var(--text-muted)' }}>Aucune entrée. Crée la première !</p>
  )

  return (
    <div className="py-1">
      {visible.map(entry => (
        <button
          key={entry.id}
          onClick={() => onSelect(entry)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors group/jentry"
          style={{
            background: selectedId === entry.id ? 'var(--selected-bg)' : 'transparent',
            minHeight: '32px',
          }}
          onMouseEnter={e => { if (selectedId !== entry.id) e.currentTarget.style.background = 'var(--hover-bg)' }}
          onMouseLeave={e => { e.currentTarget.style.background = selectedId === entry.id ? 'var(--selected-bg)' : 'transparent' }}
        >
          <span className="text-sm flex-shrink-0">{entry.icon || '📝'}</span>
          <span className="flex-1 text-sm truncate" style={{ color: selectedId === entry.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {entry.title || 'Sans titre'}
          </span>
          {(entry.tags || []).length > 0 && (
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-1 opacity-60">
              {(entry.tags || []).slice(0, 2).map(tag => (
                <span key={tag} className="text-[10px] px-1 py-0 rounded" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                  {tag}
                </span>
              ))}
              {(entry.tags || []).length > 2 && (
                <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>+{(entry.tags || []).length - 2}</span>
              )}
            </div>
          )}
        </button>
      ))}
      {hasMore && <div ref={sentinelRef} className="h-4" />}
    </div>
  )
}

export default function App({ initialPages, userId, userEmail }: { initialPages: Page[], userId: string, userEmail?: string }) {
  const [pages, setPages] = useState<Page[]>(initialPages)
  const [saving, setSaving] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  // sidebarTab: 'pages' | 'journal' — controls which tab is active in the sidebar
  const [sidebarTab, setSidebarTab] = useState<'pages' | 'journal'>('pages')
  const showJournal = sidebarTab === 'journal'
  const [showTags, setShowTags] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { theme, setTheme } = useTheme()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overPosition, setOverPosition] = useState<'before' | 'after' | 'inside' | null>(null)
  const lastSaveRef = useRef(0)
  const isMobile = useIsMobile()
  const toggleFavorite = useToggleFavorite(pages, setPages)
  const reorderFavorites = useReorderFavorites(setPages)
  const SIDEBAR_MIN = 180
  const SIDEBAR_MAX = 400
  const SIDEBAR_DEFAULT = 240
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT
    return parseInt(localStorage.getItem('sidebar_width') || String(SIDEBAR_DEFAULT), 10)
  })
  const isResizing = useRef(false)
  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    isResizing.current = true
    const startX = e.clientX
    const startW = sidebarWidth
    function onMove(ev: MouseEvent) {
      if (!isResizing.current) return
      const newW = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + ev.clientX - startX))
      setSidebarWidth(newW)
    }
    function onUp() {
      isResizing.current = false
      setSidebarWidth(w => { localStorage.setItem('sidebar_width', String(w)); return w })
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const activePages = pages.filter(p => !p.deleted_at && p.type !== 'journal')
  const journalEntries = pages.filter(p => !p.deleted_at && p.type === 'journal')
  const allTags = Array.from(new Set(pages.flatMap(p => p.tags || [])))
  const trashedPages = pages.filter(p => !!p.deleted_at)

  const [selected, setSelected] = useState<Page | null>(() => {
    if (typeof window === 'undefined') return null
    const lastId = localStorage.getItem(lastPageKey(userId))
    return initialPages.find(p => p.id === lastId && !p.deleted_at) || null
  })

  useEffect(() => {
    document.title = selected ? `Idée · ${selected.title || 'Sans titre'}` : 'Idée'
  }, [selected?.title, selected?.id])

  const selectPage = useCallback((page: Page | null) => {
    setSelected(page)
    if (!page) return
    try { localStorage.setItem(lastPageKey(userId), page.id) } catch {}
    setOpenMap(() => {
      const allPages = [...pages, ...initialPages]
      const current = allPages.find(p => p.id === page.id)
      if (!current) return {}
      const toOpen: string[] = []
      const hasChildren = allPages.some(p => p.parent_id === page.id && !p.deleted_at)
      if (hasChildren) toOpen.push(page.id)
      let c = current
      while (c?.parent_id) { toOpen.push(c.parent_id); c = allPages.find(p => p.id === c!.parent_id) as Page }
      if (!current.parent_id) { const next: Record<string, boolean> = {}; toOpen.forEach(id => { next[id] = true }); return next }
      const next: Record<string, boolean> = {}; toOpen.forEach(id => { next[id] = true }); return next
    })
  }, [pages, userId])

  useEffect(() => {
    if (!selected) return
    const ancestorIds = getAncestorIds(initialPages, selected.id)
    const hasChildren = initialPages.some(p => p.parent_id === selected.id && !p.deleted_at)
    const toOpen = hasChildren ? [selected.id, ...ancestorIds] : ancestorIds
    if (toOpen.length > 0) setOpenMap(prev => { const next = { ...prev }; toOpen.forEach(id => { next[id] = true }); return next })
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  function toggleOpen(id: string) { setOpenMap(o => ({ ...o, [id]: !o[id] })) }

  async function addPage(parentId: string | null) {
    const icons = ['📄','📝','💡','🗂️','📌','🔖','⭐','🚀','🎯','💬']
    const icon = icons[Math.floor(Math.random() * icons.length)]
    const { data } = await createClient().from('pages')
      .insert({ title: 'Sans titre', content: '', user_id: userId, parent_id: parentId, position: pages.length, icon, type: 'page' })
      .select().single()
    if (data) { setPages(prev => [...prev, data]); selectPage(data); if (parentId) setOpenMap(o => ({ ...o, [parentId]: true })) }
  }

  async function addJournalEntry() {
    const now = new Date()
    const title = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const { data } = await createClient().from('pages')
      .insert({ title, content: '', user_id: userId, parent_id: null, position: pages.length, icon: '📝', type: 'journal' })
      .select().single()
    if (data) { setPages(prev => [...prev, data]); selectPage(data) }
  }

  async function convertToJournal(id: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, type: 'journal' as const, parent_id: null } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, type: 'journal' as const, parent_id: null } : null)
    await createClient().from('pages').update({ type: 'journal', parent_id: null }).eq('id', id)
  }

  async function updateTitle(value: string) {
    if (!selected) return
    const updated = { ...selected, title: value, updated_at: new Date().toISOString() }
    setSelected(updated); setPages(prev => prev.map(p => p.id === updated.id ? updated : p)); setSaving(true)
    await createClient().from('pages').update({ title: value, updated_at: updated.updated_at }).eq('id', selected.id)
    setSaving(false)
  }

  async function updateIcon(id: string, icon: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, icon } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, icon } : null)
    await createClient().from('pages').update({ icon }).eq('id', id)
  }

  async function updateTags(id: string, tags: string[]) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, tags } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, tags } : null)
    await createClient().from('pages').update({ tags }).eq('id', id)
  }

  async function renamePage(id: string, title: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, title } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, title } : null)
    await createClient().from('pages').update({ title }).eq('id', id)
  }

  async function updateContent(content: string) {
    if (!selected) return
    const updated = { ...selected, content, updated_at: new Date().toISOString() }
    setSelected(prev => prev ? { ...prev, content } : null)
    setPages(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSaving(true)
    await createClient().from('pages').update({ content, updated_at: updated.updated_at }).eq('id', selected.id)
    const now = Date.now()
    if (now - lastSaveRef.current > 2 * 60 * 1000) {
      lastSaveRef.current = now
      await createClient().from('page_history').insert({ page_id: selected.id, user_id: userId, title: selected.title, content })
    }
    setSaving(false)
  }

  async function deletePage(id: string) {
    const deletedAt = new Date().toISOString()
    setPages(prev => prev.map(p => p.id === id || p.parent_id === id ? { ...p, deleted_at: deletedAt } : p))
    if (selected?.id === id) setSelected(activePages.find(p => p.id !== id) || null)
    await createClient().from('pages').update({ deleted_at: deletedAt }).eq('id', id)
    const children = pages.filter(p => p.parent_id === id)
    if (children.length) await createClient().from('pages').update({ deleted_at: deletedAt }).in('id', children.map(c => c.id))
  }

  async function restorePage(id: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, deleted_at: null } : p))
    await createClient().from('pages').update({ deleted_at: null }).eq('id', id)
  }

  async function deleteForever(id: string) {
    setPages(prev => prev.filter(p => p.id !== id))
    await createClient().from('pages').delete().eq('id', id)
  }

  async function logout() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  const reorderSiblings = useCallback(async (activeId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    const dragged = pages.find(p => p.id === activeId)
    const target = pages.find(p => p.id === targetId)
    if (!dragged || !target) return
    let check: Page | undefined = target
    while (check) { if (check.id === activeId) return; check = pages.find(p => p.id === check!.parent_id) }
    const newParentId = position === 'inside' ? targetId : target.parent_id
    const siblings = pages.filter(p => p.parent_id === newParentId && p.id !== activeId && !p.deleted_at).sort((a, b) => a.position - b.position)
    const targetIndex = siblings.findIndex(p => p.id === targetId)
    const insertAt = position === 'before' ? targetIndex : position === 'after' ? targetIndex + 1 : siblings.length
    siblings.splice(insertAt, 0, { ...dragged, parent_id: newParentId })
    const updates = siblings.map((p, i) => ({ id: p.id, position: i, parent_id: newParentId }))
    setPages(prev => prev.map(p => { const u = updates.find(u => u.id === p.id); return u ? { ...p, position: u.position, parent_id: u.parent_id as string | null } : p }))
    if (position === 'inside') setOpenMap(o => ({ ...o, [targetId]: true }))
    await Promise.all(updates.map(u => createClient().from('pages').update({ position: u.position, parent_id: u.parent_id }).eq('id', u.id)))
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

  const activeDragPage = pages.find(p => p.id === activeDragId)
  const subpages = selected ? activePages.filter(p => p.parent_id === selected.id) : []

  const showingJournalDesktop = !isMobile && showJournal && !selected
  const showingTagsDesktop = !isMobile && showTags && !selected

  return (
    <div className="flex w-full h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      {/* Sidebar desktop */}
      <div
        className="hidden md:flex flex-col flex-shrink-0 relative"
        style={{ width: `${sidebarWidth}px`, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
      >
        <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-400 transition-colors" title="Redimensionner">
          <div className="absolute right-0 top-0 bottom-0 w-4 -translate-x-1.5" />
        </div>
        {/* Header */}
        <div className="px-4 flex items-center justify-between" style={{ minHeight: '48px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <img src="/apple-touch-icon.png" alt="Idée" className="w-5 h-5 rounded-md flex-shrink-0" />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Idée</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Paramètres"
          >⚙️</button>
        </div>

        <SearchBar pages={[...activePages, ...journalEntries]} onSelect={selectPage} />

        {/* Onglets Pages / Journal */}
        <div className="flex px-2 pt-2 pb-1 gap-1 flex-shrink-0">
          <button
            onClick={() => { setSidebarTab('pages'); setShowTags(false); setSelected(s => s?.type === 'journal' ? null : s) }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: sidebarTab === 'pages' ? 'var(--selected-bg)' : 'transparent',
              color: sidebarTab === 'pages' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <span>📄</span>
            <span>Pages</span>
          </button>
          <button
            onClick={() => { setSidebarTab('journal'); setShowTags(false); setSelected(s => s?.type === 'page' ? null : s) }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: sidebarTab === 'journal' ? 'var(--selected-bg)' : 'transparent',
              color: sidebarTab === 'journal' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <span>📓</span>
            <span>Journal</span>
            {journalEntries.length > 0 && (
              <span className="text-[10px] px-1 rounded-full" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                {journalEntries.length}
              </span>
            )}
          </button>
        </div>

        {/* Contenu de l'onglet actif */}
        <div className="flex-1 overflow-y-auto py-1 px-2 sidebar-scroll">
          {sidebarTab === 'pages' ? (
            <>
              {activePages.filter(p => p.parent_id === null).length === 0 && (
                <p className="text-xs px-3 py-3" style={{ color: 'var(--text-muted)' }}>Clique sur + pour créer une page.</p>
              )}
              <FavoritesSection pages={activePages} selectedId={selected?.id || null} onSelect={selectPage} onToggleFavorite={toggleFavorite} onReorderFavorites={reorderFavorites} />
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                <PageTree pages={activePages} parentId={null} depth={0} selectedId={selected?.id || null}
                  onSelect={selectPage} onAdd={addPage} onToggle={toggleOpen} openMap={openMap}
                  overId={overId} overPosition={overPosition} isMobile={false}
                  onRename={renamePage} onToggleFavorite={toggleFavorite} />
                <DragOverlay>
                  {activeDragPage && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm opacity-90"
                      style={{ background: 'var(--drag-bg)', border: '1px solid var(--drag-border)', color: 'var(--text-primary)' }}>
                      <span>{activeDragPage.icon}</span>
                      <span className="truncate max-w-32">{activeDragPage.title || 'Sans titre'}</span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            </>
          ) : (
            <div className="px-3 py-3">
              {journalEntries.length === 0
                ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aucune entrée. Crée la première !</p>
                : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{journalEntries.length} entrée{journalEntries.length !== 1 ? 's' : ''}</p>
              }
            </div>
          )}
        </div>

        {/* Bas de sidebar */}
        <div className="flex-shrink-0 px-2 py-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { setShowTags(true); setSelected(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{
              background: showTags ? 'var(--selected-bg)' : 'transparent',
              color: showTags ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (!showTags) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = showTags ? 'var(--selected-bg)' : 'transparent' }}
          >
            <span>🏷️</span><span className="flex-1 text-left">Tags</span>
          </button>
          <button
            onClick={() => setShowTrash(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span>🗑</span><span className="flex-1 text-left">Corbeille</span>
            {trashedPages.length > 0 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{trashedPages.length}</span>}
          </button>
          <button
            onClick={() => sidebarTab === 'journal' ? addJournalEntry() : addPage(null)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}
          >
            <span>{sidebarTab === 'journal' ? '✏️' : '+'}</span>
            <span>{sidebarTab === 'journal' ? 'Nouvelle entrée' : 'Nouvelle page'}</span>
          </button>
        </div>
      </div>

      {/* Mobile : vue liste (avec onglets dans MobileHomeView) */}
      {isMobile && !selected && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <MobileHomeView
            pages={[...activePages, ...journalEntries]} selectedId={null}
            onSelect={p => selectPage(p)}
            onAdd={() => addPage(null)} onShowTrash={() => setShowTrash(true)}
            trashedCount={trashedPages.length} onToggleFavorite={toggleFavorite}
            onShowJournal={() => {}} journalCount={journalEntries.length}
            onAddJournalEntry={addJournalEntry}
          />
        </div>
      )}

      {showTrash && <TrashPanel trashedPages={trashedPages} onRestore={restorePage} onDeleteForever={deleteForever} onClose={() => setShowTrash(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onLogout={logout} pages={pages} userId={userId} userEmail={userEmail} />}

      {/* Desktop : vue tags */}
      {showingTagsDesktop && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TagsView pages={[...activePages, ...journalEntries]} onSelect={p => { selectPage(p); setShowTags(false) }} />
        </div>
      )}

      {/* Desktop : vue liste journal */}
      {showingJournalDesktop && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <JournalList entries={journalEntries} selectedId={null} onSelect={p => selectPage(p)} onAdd={addJournalEntry} />
        </div>
      )}

      {/* Contenu — page ou entrée journal */}
      <div className={`${(isMobile && !selected) || showingTagsDesktop || showingJournalDesktop ? 'hidden' : ''} flex-1 overflow-y-auto min-w-0`}>
        {selected ? (
          <div className="page-card my-4 mx-3 md:mx-auto md:my-6 flex flex-col">
            {selected.type === 'journal' ? (
              <>
                <MobileTopBar onBack={() => { setSelected(null) }} saving={saving} />
                <JournalEntryHeader entry={selected}
                  onBack={() => { setSelected(null) }}
                  onTitleChange={updateTitle}
                  onIconChange={(emoji) => updateIcon(selected.id, emoji)}
                  saving={saving} isMobile={isMobile}
                  onCreatedAtChange={async (iso) => {
                    setSelected(prev => prev ? { ...prev, created_at: iso } : null)
                    setPages(prev => prev.map(p => p.id === selected.id ? { ...p, created_at: iso } : p))
                    await createClient().from('pages').update({ created_at: iso }).eq('id', selected.id)
                  }}
                  onDateChange={async (iso) => {
                    setSelected(prev => prev ? { ...prev, updated_at: iso } : null)
                    setPages(prev => prev.map(p => p.id === selected.id ? { ...p, updated_at: iso } : p))
                    await createClient().from('pages').update({ updated_at: iso }).eq('id', selected.id)
                  }}
                />
                <TagsInput tags={selected.tags || []} onChange={tags => updateTags(selected.id, tags)} allTags={allTags} />
                <Editor key={selected.id} page={selected} pages={[...activePages, ...journalEntries]}
                  onUpdate={updateContent} onAddSubpage={() => {}}
                  onNavigate={p => { selectPage(p) }}
                  userId={userId} isMobile={isMobile} />
              </>
            ) : (
              <>
                <MobileTopBar onBack={() => setSelected(null)} saving={saving} />
                <div className="hidden md:flex items-center justify-between px-6 pt-3 pb-1">
                  <BreadcrumbInline pages={activePages} selected={selected} onSelect={selectPage} />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={`w-4 h-4 flex items-center justify-center transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    </span>
                    <ActionsMenu onDelete={() => setConfirmDeleteId(selected.id)} onConvertToJournal={() => convertToJournal(selected.id)}>
                      <div className="px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100"
                        style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                        <HistoryButton page={selected} onRestore={(title, content) => {
                          setSelected(prev => prev ? { ...prev, title, content } : null)
                          setPages(prev => prev.map(p => p.id === selected.id ? { ...p, title, content } : p))
                        }} />
                      </div>
                      <div className="px-3 py-2.5 text-sm border-b"
                        style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                        <ExportButton page={selected} />
                      </div>
                      <div className="px-3 py-2.5 text-sm border-b"
                        style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                        <ShareButton page={selected as any} onUpdate={(updates) => {
                          setSelected(prev => prev ? { ...prev, ...updates } : null)
                          setPages(prev => prev.map(p => p.id === selected.id ? { ...p, ...updates } : p))
                        }} />
                      </div>
                    </ActionsMenu>
                  </div>
                </div>
                <div className="px-6 pt-2 pb-1">
                  <div className="flex items-start gap-3 group/title">
                    <div className="relative flex-shrink-0">
                      <button onClick={() => setShowIconPicker(v => !v)} className="text-4xl hover:opacity-70 transition-opacity" style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{selected.icon || '📄'}</button>
                      {showIconPicker && <div className={isMobile ? 'fixed inset-x-4 top-20 z-50' : 'absolute top-full left-0 z-50'}><EmojiPicker onSelect={(emoji) => { updateIcon(selected.id, emoji); setShowIconPicker(false) }} onClose={() => setShowIconPicker(false)} /></div>}
                    </div>
                    <input
                      className="page-title flex-1 text-2xl md:text-3xl outline-none bg-transparent min-w-0 pt-1"
                      style={{ minHeight: '44px', caretColor: 'var(--text-primary)' }}
                      value={selected.title}
                      onChange={e => updateTitle(e.target.value)}
                      placeholder="Sans titre"
                    />
                    <button onClick={() => toggleFavorite(selected.id)}
                      className={`flex-shrink-0 mt-2 text-xl transition-all ${selected.favorite ? 'opacity-100' : 'opacity-0 group-hover/title:opacity-100 hover:!opacity-100'}`}
                      style={{ color: selected.favorite ? '#f59e0b' : 'var(--text-faint)' }}
                      title={selected.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                      {selected.favorite ? '★' : '☆'}
                    </button>
                  </div>
                  <PageDates page={selected}
                    onCreatedAtChange={async (iso) => {
                      setSelected(prev => prev ? { ...prev, created_at: iso } : null)
                      setPages(prev => prev.map(p => p.id === selected.id ? { ...p, created_at: iso } : p))
                      await createClient().from('pages').update({ created_at: iso }).eq('id', selected.id)
                    }}
                    onUpdatedAtChange={async (iso) => {
                      setSelected(prev => prev ? { ...prev, updated_at: iso } : null)
                      setPages(prev => prev.map(p => p.id === selected.id ? { ...p, updated_at: iso } : p))
                      await createClient().from('pages').update({ updated_at: iso }).eq('id', selected.id)
                    }}
                  />
                </div>
                <TagsInput tags={selected.tags || []} onChange={tags => updateTags(selected.id, tags)} allTags={allTags} />
                <SubpagesList subpages={subpages} onSelect={selectPage} onReorder={(a, o, p) => reorderSiblings(a, o, p)} isMobile={isMobile} onAddSubpage={() => addPage(selected.id)} />
                <Editor key={selected.id} page={selected} pages={[...activePages, ...journalEntries]}
                  onUpdate={updateContent} onAddSubpage={() => addPage(selected.id)}
                  onNavigate={p => { selectPage(p) }}
                  userId={userId} isMobile={isMobile} />
              </>
            )}
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center h-full">
            <div className="text-center">
              <p className="text-4xl mb-3">💡</p>
              <p className="text-lg font-medium mb-1" style={{ color: 'var(--empty-title)' }}>Aucune page sélectionnée</p>
              <button onClick={() => addPage(null)} className="text-sm text-blue-500 hover:text-blue-400 underline">Créer une page</button>
            </div>
          </div>
        )}
      </div>

      {confirmDeleteId && (() => {
        const page = pages.find(p => p.id === confirmDeleteId)
        if (!page) return null
        return <ConfirmTrashModal page={page} onConfirm={() => { deletePage(confirmDeleteId); setConfirmDeleteId(null) }} onCancel={() => setConfirmDeleteId(null)} />
      })()}
    </div>
  )
}
