'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
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
import { toast } from './components/Toast'
import TemplateModal, { Template } from './components/TemplateModal'
import QuickCapture from './components/QuickCapture'
import RecentView from './components/RecentView'
import ReviewMode from './components/ReviewMode'

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

export default function App({ initialPages, userId, userEmail, initialPageId }: { initialPages: Page[], userId: string, userEmail?: string, initialPageId?: string }) {
  const [pages, setPages] = useState<Page[]>(initialPages)
  const [saving, setSaving] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [showJournal, setShowJournal] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const { theme, setTheme } = useTheme()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overPosition, setOverPosition] = useState<'before' | 'after' | 'inside' | null>(null)
  const lastSaveRef = useRef(0)
  const addingPageRef = useRef(false)
  const pointerYRef = useRef(0)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverOverIdRef = useRef<string | null>(null)
  const searchBarRef = useRef<{ focus: () => void }>(null)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const [scrolledPast, setScrolledPast] = useState(false)
  const isMobile = useIsMobile()
  const toggleFavorite = useToggleFavorite(pages, setPages)

  // Offline / online detection
  useEffect(() => {
    function onOffline() { toast('Connexion perdue — les modifications ne sont pas sauvegardées.', 'error') }
    function onOnline()  { toast('Connexion rétablie.', 'success') }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online',  onOnline)
    return () => { window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline) }
  }, [])

  // Track pointer Y globally — throttled via rAF to avoid layout thrashing
  useEffect(() => {
    let frameId: number
    function onPointerMove(e: PointerEvent) {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => { pointerYRef.current = e.clientY })
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => { window.removeEventListener('pointermove', onPointerMove); cancelAnimationFrame(frameId) }
  }, [])
  const SIDEBAR_MIN = 180
  const SIDEBAR_MAX = 400
  const SIDEBAR_DEFAULT = 240
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    try { setSidebarWidth(parseInt(localStorage.getItem('sidebar_width') || String(SIDEBAR_DEFAULT), 10)) } catch {}
    setMounted(true)
  }, [])
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
    if (initialPageId) {
      const fromUrl = initialPages.find(p => p.id === initialPageId && !p.deleted_at)
      if (fromUrl) return fromUrl
    }
    return null
  })

  useEffect(() => {
    if (initialPageId) return
    try {
      const lastId = localStorage.getItem(lastPageKey(userId))
      const page = initialPages.find(p => p.id === lastId && !p.deleted_at)
      if (page) setSelected(page)
    } catch {}
  }, [])

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

  function slugify(title: string) {
    return title
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      || 'sans-titre'
  }

  const selectPage = useCallback((page: Page | null) => {
    setSelected(page)
    if (page) {
      const slug = `${slugify(page.title || 'sans-titre')}--${page.id}`
      try { window.history.replaceState({}, '', `/app/p/${slug}`) } catch {}
      try { localStorage.setItem(lastPageKey(userId), page.id) } catch {}
    } else {
      try { window.history.replaceState({}, '', '/app') } catch {}
    }
    if (!page) return
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

  // Keyboard shortcuts — bare keys (only when not typing in a field/editor)
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
    }
    function onKeyDown(e: KeyboardEvent) {
      // ⌘+/ → focus search (safe, no browser conflict)
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault(); e.stopPropagation(); searchBarRef.current?.focus(); return
      }
      // Bare keys — only when not in a text field
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (isTyping()) return
      if (e.key === 'n') { e.preventDefault(); addPage(null) }
      if (e.key === 'f') { e.preventDefault(); setFocusMode(v => !v) }
      if (e.key === 'q') { e.preventDefault(); setShowQuickCapture(true) }
      if (e.key === 'Escape') { setFocusMode(false) }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [addPage])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  function toggleOpen(id: string) { setOpenMap(o => ({ ...o, [id]: !o[id] })) }

  async function addPage(parentId: string | null, template?: Template) {
    if (addingPageRef.current) return
    addingPageRef.current = true
    try {
      const icons = ['📄','📝','💡','🗂️','📌','🔖','⭐','🚀','🎯','💬']
      const icon = template?.icon || icons[Math.floor(Math.random() * icons.length)]
      const { data } = await createClient().from('pages')
        .insert({ title: template?.title || 'Sans titre', content: template?.content || '', user_id: userId, parent_id: parentId, position: pages.length, icon, type: 'page' })
        .select().single()
      if (data) { setPages(prev => [...prev, data]); selectPage(data); if (parentId) setOpenMap(o => ({ ...o, [parentId]: true })) }
    } finally {
      addingPageRef.current = false
    }
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
    try {
      const { error } = await createClient().from('pages').update({ title: value, updated_at: updated.updated_at }).eq('id', selected.id)
      if (error) throw error
    } catch {
      toast('Erreur de sauvegarde — vérifiez votre connexion.', 'error')
    } finally {
      setSaving(false)
    }
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
    try {
      const { error } = await createClient().from('pages').update({ content, updated_at: updated.updated_at }).eq('id', selected.id)
      if (error) throw error
      const now = Date.now()
      if (now - lastSaveRef.current > 2 * 60 * 1000) {
        lastSaveRef.current = now
        await createClient().from('page_history').insert({ page_id: selected.id, user_id: userId, title: selected.title, content })
      }
    } catch {
      toast('Erreur de sauvegarde — vérifiez votre connexion.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deletePage(id: string) {
    const deletedAt = new Date().toISOString()
    const wasJournal = selected?.id === id && selected?.type === 'journal'
    setPages(prev => prev.map(p => p.id === id || p.parent_id === id ? { ...p, deleted_at: deletedAt } : p))
    if (selected?.id === id) {
      if (wasJournal) {
        setSelected(null)
        setShowJournal(true)
      } else {
        setSelected(activePages.find(p => p.id !== id && p.type !== 'journal') || null)
      }
    }
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
        // Après 400ms sur le même item → inside
        if (hoverOverIdRef.current === overId) {
          setOverPosition('inside')
        }
      }, 400)
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
  const showingRecentDesktop = !isMobile && showRecent && !selected
  const showingReviewDesktop = !isMobile && showReview && !selected

  if (!mounted) {
    return <div style={{ position: 'fixed', inset: 0, background: '#f0f0ec' }} />
  }

  const sidebarHiddenEff = sidebarHidden || focusMode

  return (
    <div className="flex w-full h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>

      {/* ── Sidebar desktop ── */}
      <div
        className="hidden md:flex flex-col flex-shrink-0 relative overflow-hidden"
        style={{
          width: sidebarHiddenEff ? 0 : `${sidebarWidth}px`,
          background: 'var(--sidebar-bg)',
          borderRight: sidebarHiddenEff ? 'none' : '1px solid var(--border)',
          transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
          minWidth: 0,
        }}
      >
        <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-400 transition-colors" title="Redimensionner">
          <div className="absolute right-0 top-0 bottom-0 w-4 -translate-x-1.5" />
        </div>

        {/* Header */}
        <div className="px-3 flex items-center justify-between gap-2" style={{ minHeight: '52px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <img src="/apple-touch-icon.png" alt="Idée" className="w-6 h-6 rounded-lg flex-shrink-0" />
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1 }}>
              Idée
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setSidebarHidden(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              title="Masquer la sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="1" y="1" width="12" height="12" rx="2" />
                <path d="M4.5 1v12" />
                <path d="M7.5 5l-1.5 2 1.5 2" />
              </svg>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              title="Paramètres"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7.5" cy="7.5" r="2" />
                <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.7 2.7l1.1 1.1M11.2 11.2l1.1 1.1M11.2 2.7l-1.1 1.1M3.8 11.2l-1.1 1.1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bouton nouvelle page — au dessus de la recherche */}
        <div className="px-2 pt-2 pb-1">
          <button
            onClick={() => showJournal ? addJournalEntry() : setShowTemplateModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}
            title={showJournal ? 'Nouvelle entrée' : 'Nouvelle page — touche N'}
          >
            <span>{showJournal ? '✏️' : '+'}</span>
            <span className="flex-1">{showJournal ? 'Nouvelle entrée' : 'Nouvelle page'}</span>
            {!showJournal && (
              <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono opacity-60" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>N</kbd>
            )}
          </button>
        </div>

        <SearchBar ref={searchBarRef} pages={[...activePages, ...journalEntries]} onSelect={selectPage} />
        <div className="flex px-2 pt-1 pb-1 gap-1 flex-shrink-0">
          <button
            onClick={() => { setShowJournal(false); setShowTags(false); setShowRecent(false); setShowReview(false); setSelected(s => s?.type === 'journal' ? null : s) }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: !showJournal && !showTags && !showRecent && !showReview ? 'var(--selected-bg)' : 'transparent',
              color: !showJournal && !showTags && !showRecent && !showReview ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (showJournal || showTags || showRecent || showReview) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = !showJournal && !showTags && !showRecent && !showReview ? 'var(--selected-bg)' : 'transparent' }}
          >
            <span>📄</span><span>Notes</span>
          </button>
          <button
            onClick={() => { setShowJournal(true); setShowTags(false); setShowRecent(false); setShowReview(false); setSelected(null) }}
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            autoScroll={{ enabled: true, threshold: { x: 0, y: 0.12 } }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <PageTree pages={activePages} parentId={null} depth={0} selectedId={selected?.id || null}
              onSelect={selectPage} onAdd={addPage} onToggle={toggleOpen} openMap={openMap}
              overId={overId} overPosition={overPosition} isMobile={false}
              onRename={renamePage} onToggleFavorite={toggleFavorite} />
            <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeDragPage && (
                <div
                  className="drag-overlay flex items-center gap-2 px-3 py-2 rounded-xl text-sm select-none"
                  style={{
                    background: 'var(--drag-bg)',
                    border: '1px solid var(--drop-indicator)',
                    color: 'var(--text-primary)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
                    minWidth: '120px',
                    maxWidth: '220px',
                  }}
                >
                  <span>{activeDragPage.icon}</span>
                  <span className="truncate flex-1">{activeDragPage.title || 'Sans titre'}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
        <div className="flex-shrink-0 px-2 py-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { setShowRecent(true); setShowReview(false); setShowJournal(false); setShowTags(false); setSelected(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{
              background: showRecent ? 'var(--selected-bg)' : 'transparent',
              color: showRecent ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (!showRecent) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = showRecent ? 'var(--selected-bg)' : 'transparent' }}
          >
            <span>🕘</span><span className="flex-1 text-left">Vue récente</span>
          </button>
          <button
            onClick={() => { setShowReview(true); setShowRecent(false); setShowJournal(false); setShowTags(false); setSelected(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{
              background: showReview ? 'var(--selected-bg)' : 'transparent',
              color: showReview ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (!showReview) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = showReview ? 'var(--selected-bg)' : 'transparent' }}
          >
            <span>🔄</span><span className="flex-1 text-left">Réviser</span>
          </button>
          <button
            onClick={() => { setShowTags(true); setShowJournal(false); setShowRecent(false); setShowReview(false); setSelected(null) }}
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
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <button
            onClick={() => setFocusMode(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{
              background: focusMode ? 'var(--selected-bg)' : 'transparent',
              color: focusMode ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (!focusMode) e.currentTarget.style.background = 'var(--hover-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = focusMode ? 'var(--selected-bg)' : 'transparent' }}
            title="Mode focus — touche F"
          >
            <span>🎯</span>
            <span className="flex-1 text-left">Mode focus</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>F</kbd>
          </button>
          <button
            onClick={() => setShowQuickCapture(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Capture rapide — touche Q"
          >
            <span>⚡</span>
            <span className="flex-1 text-left">Capture rapide</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Q</kbd>
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
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onLogout={logout} pages={pages} userId={userId} userEmail={userEmail} onNavigate={p => { selectPage(p); setShowSettings(false); setShowJournal(p.type === 'journal') }} />}

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

      {/* ── Desktop : vue récente ── */}
      {showingRecentDesktop && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <RecentView pages={[...activePages, ...journalEntries]} onSelect={p => { selectPage(p); setShowRecent(false); if (p.type === 'journal') setShowJournal(true) }} />
        </div>
      )}

      {/* ── Desktop : mode révision ── */}
      {showingReviewDesktop && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ReviewMode pages={[...activePages, ...journalEntries]} onNavigate={p => { selectPage(p); setShowReview(false) }} onClose={() => setShowReview(false)} />
        </div>
      )}

      {/* ── Bouton toggle sidebar (focus mode) ── */}
      {!isMobile && (
        <button
          onClick={() => { setFocusMode(false); setSidebarHidden(v => !v) }}
          title={sidebarHiddenEff ? 'Afficher la sidebar' : 'Masquer la sidebar'}
          className="hidden md:flex fixed bottom-5 left-5 z-30 items-center justify-center w-8 h-8 rounded-full shadow-md"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            opacity: sidebarHiddenEff ? 1 : 0,
            pointerEvents: sidebarHiddenEff ? 'auto' : 'none',
            transform: sidebarHiddenEff ? 'translateX(0)' : 'translateX(-4px)',
            transition: 'opacity 180ms ease, transform 180ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--hover-bg)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--card-bg)' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <rect x="1" y="1" width="11" height="11" rx="2" />
            <path d="M4 1v11" />
          </svg>
        </button>
      )}

      {/* ── Contenu principal ── */}
      <div ref={mainScrollRef} className={`${(isMobile && !selected) || showingJournalDesktop || showingTagsDesktop || showingRecentDesktop || showingReviewDesktop ? 'hidden' : ''} flex-1 overflow-y-auto min-w-0 pb-12`}>
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
                focusMode={focusMode}
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

      {showTemplateModal && (
        <TemplateModal
          onSelect={t => { addPage(null, t); setShowTemplateModal(false) }}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {showQuickCapture && (
        <QuickCapture
          onSave={async (title, content) => {
            await addPage(null, { icon: '⚡', title, content: content ? `<p>${content}</p>` : '' })
          }}
          onClose={() => setShowQuickCapture(false)}
        />
      )}

      {confirmDeleteId && (() => {
        const page = pages.find(p => p.id === confirmDeleteId)
        if (!page) return null
        return <ConfirmTrashModal page={page} onConfirm={() => { deletePage(confirmDeleteId); setConfirmDeleteId(null) }} onCancel={() => setConfirmDeleteId(null)} />
      })()}
    </div>
  )
}
