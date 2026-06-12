'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { Page } from './types'
import { useIsMobile, useToggleFavorite } from './hooks'
import { SearchBar } from './components/SearchBar'
import { TrashPanel } from './components/TrashPanel'
import { PageTree, FavoritesSection } from './components/PageTree'
import { SubpagesList } from './components/SubpagesList'
import { MobileHomeView, MobileTopBar } from './components/MobileNav'
import { ConfirmTrashModal } from './components/ActionsMenu'
import { JournalList } from './components/JournalView'
import { SettingsPanel, useTheme } from './components/SettingsPanel'
import { TagsView } from './components/TagsView'
import { PageHeader, Cover } from './components/PageHeader'

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

export default function App({ initialPages, userId, userEmail }: { initialPages: Page[], userId: string, userEmail?: string }) {
  const [pages, setPages] = useState<Page[]>(initialPages)
  const [saving, setSaving] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [showJournal, setShowJournal] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { theme, setTheme } = useTheme()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overPosition, setOverPosition] = useState<'before' | 'after' | 'inside' | null>(null)
  const lastSaveRef = useRef(0)
  const pointerYRef = useRef(0)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverOverIdRef = useRef<string | null>(null)
  const searchBarRef = useRef<{ focus: () => void }>(null)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const [scrolledPast, setScrolledPast] = useState(false)
  const isMobile = useIsMobile()
  const toggleFavorite = useToggleFavorite(pages, setPages)

  // Track pointer Y globally — fiable pendant le drag
  useEffect(() => {
    function onPointerMove(e: PointerEvent) { pointerYRef.current = e.clientY }
    window.addEventListener('pointermove', onPointerMove)
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])
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
  const trashedPages = pages.filter(p => !!p.deleted_at)

  const [selected, setSelected] = useState<Page | null>(() => {
    if (typeof window === 'undefined') return null
    const lastId = localStorage.getItem(lastPageKey(userId))
    return initialPages.find(p => p.id === lastId && !p.deleted_at) || null
  })

  useEffect(() => {
    document.title = selected ? `Idée · ${selected.title || 'Sans titre'}` : 'Idée'
  }, [selected?.title, selected?.id])

  useEffect(() => {
    if (!selected) return
    const updated = pages.find(p => p.id === selected.id)
    if (updated && (updated.favorite !== selected.favorite || updated.favorite_position !== selected.favorite_position)) {
      setSelected(prev => prev ? { ...prev, favorite: updated.favorite, favorite_position: updated.favorite_position } : null)
    }
  }, [pages])

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
      const next: Record<string, boolean> = {}
      toOpen.forEach(id => { next[id] = true })
      return next
    })
  }, [pages, userId])

  useEffect(() => {
    if (!selected) return
    const ancestorIds = getAncestorIds(initialPages, selected.id)
    const hasChildren = initialPages.some(p => p.parent_id === selected.id && !p.deleted_at)
    const toOpen = hasChildren ? [selected.id, ...ancestorIds] : ancestorIds
    if (toOpen.length > 0) setOpenMap(prev => { const next = { ...prev }; toOpen.forEach(id => { next[id] = true }); return next })
  }, [])

  // Sticky header: observe the page title element via IntersectionObserver
  // → appears exactly when the title scrolls out of view, disappears when it comes back
  useEffect(() => {
    if (isMobile) return
    const titleEl = document.querySelector('.page-title')
    if (!titleEl) return
    const observer = new IntersectionObserver(
      ([entry]) => setScrolledPast(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(titleEl)
    return () => observer.disconnect()
  }, [selected?.id, isMobile])

  // Reset scroll & sticky on page change
  useEffect(() => {
    setScrolledPast(false)
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0
  }, [selected?.id])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '/') { e.preventDefault(); e.stopPropagation(); searchBarRef.current?.focus() }
      if (e.key === 'n' && !e.shiftKey) { e.preventDefault(); addPage(null) }
      if ((e.key === 'j' || e.key === 'J') && e.shiftKey) { e.preventDefault(); addJournalEntry() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [addPage, addJournalEntry])

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
    if (data) { setPages(prev => [...prev, data]); selectPage(data); setShowJournal(false) }
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

  async function updateCreatedAt(id: string, iso: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, created_at: iso } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, created_at: iso } : null)
    await createClient().from('pages').update({ created_at: iso }).eq('id', id)
  }

  async function renamePage(id: string, title: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, title } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, title } : null)
    await createClient().from('pages').update({ title }).eq('id', id)
  }

  async function updateContent(content: string) {
    if (!selected) return
    const updated = { ...selected, content, updated_at: new Date().toISOString() }
    setSelected(prev => prev ? { ...prev, content, updated_at: updated.updated_at } : null)
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
    if (!over || over.id === active.id) {
      setOverId(null); setOverPosition(null)
      if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
      hoverOverIdRef.current = null
      return
    }
    const overId = over.id as string
    setOverId(overId)
    const r = over.rect
    if (!r) return

    // Position before/after selon Y — affiché immédiatement
    const relY = pointerYRef.current - r.top
    const ratio = relY / r.height
    const immediatePos = ratio < 0.5 ? 'before' : 'after'

    // Si on entre sur un nouvel item, lancer le timer "inside"
    if (hoverOverIdRef.current !== overId) {
      hoverOverIdRef.current = overId
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      setOverPosition(immediatePos)
      hoverTimerRef.current = setTimeout(() => {
        // Après 600ms sur le même item → inside
        if (hoverOverIdRef.current === overId) {
          setOverPosition('inside')
        }
      }, 600)
    } else {
      // Même item — si pas encore "inside", mettre à jour before/after
      setOverPosition(prev => prev === 'inside' ? 'inside' : immediatePos)
    }
  }
  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    const finalPosition = overPosition
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    hoverOverIdRef.current = null
    setActiveDragId(null); setOverId(null); setOverPosition(null)
    if (!over || active.id === over.id) return
    await reorderSiblings(active.id as string, over.id as string, finalPosition || 'after')
  }

  const activeDragPage = pages.find(p => p.id === activeDragId)
  const subpages = selected ? activePages.filter(p => p.parent_id === selected.id) : []
  const showingJournalDesktop = !isMobile && showJournal && !selected
  const showingTagsDesktop = !isMobile && showTags && !selected

  return (
    <div className="flex w-full h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>

      {/* ── Sidebar desktop ── */}
      <div
        className="hidden md:flex flex-col flex-shrink-0 relative"
        style={{ width: `${sidebarWidth}px`, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
      >
        <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-400 transition-colors" title="Redimensionner">
          <div className="absolute right-0 top-0 bottom-0 w-4 -translate-x-1.5" />
        </div>
        <div className="px-4 flex items-center justify-between" style={{ minHeight: '48px', borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Idée</span>
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Paramètres"
          >⚙️</button>
        </div>
        <SearchBar ref={searchBarRef} pages={[...activePages, ...journalEntries]} onSelect={selectPage} />
        <div className="flex px-2 pt-1 pb-1 gap-1 flex-shrink-0">
          <button
            onClick={() => { setShowJournal(false); setShowTags(false); setSelected(s => s?.type === 'journal' ? null : s) }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: !showJournal && !showTags ? 'var(--selected-bg)' : 'transparent',
              color: !showJournal && !showTags ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (showJournal || showTags) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = !showJournal && !showTags ? 'var(--selected-bg)' : 'transparent' }}
          >
            <span>📄</span><span>Notes</span>
          </button>
          <button
            onClick={() => { setShowJournal(true); setShowTags(false); setSelected(null) }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: showJournal ? 'var(--selected-bg)' : 'transparent',
              color: showJournal ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (!showJournal) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = showJournal ? 'var(--selected-bg)' : 'transparent' }}
          >
            <span>📓</span><span>Journal</span>
            {journalEntries.length > 0 && <span className="text-[10px] opacity-60">{journalEntries.length}</span>}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 sidebar-scroll">
          {activePages.filter(p => p.parent_id === null).length === 0 && (
            <p className="text-xs px-3 py-3" style={{ color: 'var(--text-muted)' }}>Clique sur + pour créer une page.</p>
          )}
          <FavoritesSection
            pages={activePages}
            selectedId={selected?.id || null}
            onSelect={selectPage}
            onToggleFavorite={toggleFavorite}
            onReorderFavorites={async (orderedIds) => {
              const updates = orderedIds.map((id, i) => ({ id, favorite_position: i }))
              setPages(prev => prev.map(p => { const u = updates.find(u => u.id === p.id); return u ? { ...p, favorite_position: u.favorite_position } : p }))
              await Promise.all(updates.map(u => createClient().from('pages').update({ favorite_position: u.favorite_position }).eq('id', u.id)))
            }}
          />
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
        </div>
        <div className="flex-shrink-0 px-2 py-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { setShowTags(true); setShowJournal(false); setSelected(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{
              background: showTags ? 'var(--selected-bg)' : 'transparent',
              color: showTags ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (!showTags) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = showTags ? 'var(--selected-bg)' : 'transparent' }}
          >
            <span>🏷️</span>
            <span className="flex-1 text-left">Tags</span>
            {Array.from(new Set([...activePages, ...journalEntries].flatMap(p => p.tags || []))).length > 0 && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {Array.from(new Set([...activePages, ...journalEntries].flatMap(p => p.tags || []))).length}
              </span>
            )}
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
            onClick={() => showJournal ? addJournalEntry() : addPage(null)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}
          >
            <span>{showJournal ? '✏️' : '+'}</span>
            <span>{showJournal ? 'Nouvelle entrée' : 'Nouvelle page'}</span>
          </button>
        </div>
      </div>

      {/* ── Mobile : vue liste ── */}
      {isMobile && !selected && !showJournal && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <MobileHomeView
            pages={[...activePages, ...journalEntries]} selectedId={null}
            onSelect={p => { selectPage(p); setShowJournal(false) }}
            onAdd={() => addPage(null)} onShowTrash={() => setShowTrash(true)}
            trashedCount={trashedPages.length} onToggleFavorite={toggleFavorite}
            onShowJournal={() => setShowJournal(true)} journalCount={journalEntries.length}
            onAddJournalEntry={addJournalEntry}
          />
        </div>
      )}

      {/* ── Mobile : vue journal ── */}
      {isMobile && showJournal && !selected && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2 flex-shrink-0">
            <button onClick={() => setShowJournal(false)} className="text-sm" style={{ color: 'var(--text-muted)' }}>← Pages</button>
          </div>
          <JournalList entries={journalEntries} selectedId={null} onSelect={p => { selectPage(p); setShowJournal(false) }} onAdd={addJournalEntry} />
        </div>
      )}

      {showTrash && <TrashPanel trashedPages={trashedPages} onRestore={restorePage} onDeleteForever={deleteForever} onClose={() => setShowTrash(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onLogout={logout} pages={pages} userId={userId} userEmail={userEmail} />}

      {/* ── Desktop : vue journal ── */}
      {showingJournalDesktop && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <JournalList entries={journalEntries} selectedId={null} onSelect={p => { selectPage(p); setShowJournal(false) }} onAdd={addJournalEntry} />
        </div>
      )}

      {/* ── Desktop : vue tags ── */}
      {showingTagsDesktop && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TagsView pages={[...activePages, ...journalEntries]} onSelect={p => { selectPage(p); setShowTags(false); if (p.type === 'journal') setShowJournal(true) }} />
        </div>
      )}

      {/* ── Contenu principal ── */}
      <div ref={mainScrollRef} className={`${(isMobile && !selected) || showingJournalDesktop || showingTagsDesktop ? 'hidden' : ''} flex-1 overflow-y-auto min-w-0 pb-12`}>
        {selected ? (
          <>
            {/* Cover pleine largeur, sticky derrière le contenu */}
            <div className="sticky top-0 z-0 w-full">
              <Cover
                page={selected}
                userId={userId}
                onCoverUpdate={cover => {
                  setSelected(prev => prev ? { ...prev, cover_url: cover } : null)
                  setPages(prev => prev.map(p => p.id === selected.id ? { ...p, cover_url: cover } : p))
                }}
              />
            </div>
            {/* Sticky mini header — direct child of scroll container, not inside page-card */}
            {scrolledPast && !isMobile && (
              <>
                <style>{`@keyframes _shi{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
                <div className="sticky top-0 z-20 flex items-center gap-2 px-5"
                  style={{ height: '44px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', animation: '_shi 180ms ease both' }}>
                  <span className="text-lg flex-shrink-0">{selected.icon || '📄'}</span>
                  <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {selected.title || 'Sans titre'}
                  </span>
                </div>
              </>
            )}
            {/* Card contenu qui chevauche la cover */}
            <div className="page-card relative z-10 mx-3 md:mx-auto mb-6 flex flex-col rounded-t-2xl" style={{ marginTop: '-32px', boxShadow: '0 -6px 24px 0 rgba(0,0,0,0.10)' }}>
              <MobileTopBar
                onBack={() => {
                  if (selected.type === 'journal') { setSelected(null); setShowJournal(true) }
                  else setSelected(null)
                }}
                saving={saving}
              />
              <PageHeader
                page={selected}
                pages={[...activePages, ...journalEntries]}
                userId={userId}
                saving={saving}
                isMobile={isMobile}
                onBack={() => { setSelected(null); setShowJournal(true) }}
                onSelectPage={selectPage}
                onTitleChange={updateTitle}
                onIconChange={emoji => updateIcon(selected.id, emoji)}
                onTagsChange={tags => updateTags(selected.id, tags)}
                onToggleFavorite={toggleFavorite}
                onDelete={() => setConfirmDeleteId(selected.id)}
                onConvertToJournal={() => convertToJournal(selected.id)}
                onCreatedAtChange={iso => updateCreatedAt(selected.id, iso)}
                onRestore={(title, content) => {
                  setSelected(prev => prev ? { ...prev, title, content } : null)
                  setPages(prev => prev.map(p => p.id === selected.id ? { ...p, title, content } : p))
                }}
                onShareUpdate={updates => {
                  setSelected(prev => prev ? { ...prev, ...updates } : null)
                  setPages(prev => prev.map(p => p.id === selected.id ? { ...p, ...updates } : p))
                }}
                onSummaryUpdate={summary => {
                  setSelected(prev => prev ? { ...prev, summary: summary ?? undefined } : null)
                  setPages(prev => prev.map(p => p.id === selected.id ? { ...p, summary: summary ?? undefined } : p))
                }}
              />
              {selected.type !== 'journal' && (
                <SubpagesList
                  page={selected}
                  subpages={subpages}
                  onSelect={selectPage}
                  onReorder={(a, o, p) => reorderSiblings(a, o, p)}
                  isMobile={isMobile}
                  onAddSubpage={() => addPage(selected.id)}
                />
              )}
              <Editor
                key={selected.id}
                page={selected}
                pages={[...activePages, ...journalEntries]}
                onUpdate={updateContent}
                onAddSubpage={() => addPage(selected.id)}
                onNavigate={p => { selectPage(p); if (p.type === 'journal') setShowJournal(false) }}
                userId={userId}
                isMobile={isMobile}
              />
            </div>
          </>
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
