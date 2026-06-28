'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type CollisionDetection, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'

// Collision detection vertical uniquement (ignore le décalage horizontal des items indentés)
const closestVertical: CollisionDetection = ({ collisionRect, droppableRects, droppableContainers }) => {
  let bestId = null as null | string | number
  let bestDist = Infinity
  for (const container of droppableContainers) {
    const rect = droppableRects.get(container.id)
    if (!rect) continue
    const dist = Math.abs((rect.top + rect.bottom) / 2 - (collisionRect.top + collisionRect.bottom) / 2)
    if (dist < bestDist) { bestDist = dist; bestId = container.id }
  }
  return bestId != null ? [{ id: bestId }] : []
}
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
import { HistoryModal } from './components/HistoryModal'
import { TagsView } from './components/TagsView'
import { PageHeader } from './components/PageHeader'
import { toast, Toaster } from './components/Toast'
import TemplateModal, { Template } from './components/TemplateModal'
import QuickCapture from './components/QuickCapture'
import RecentView from './components/RecentView'
import ReviewMode from './components/ReviewMode'

export type { Page }
const lastPageKey = (userId: string) => `idee_last_page_${userId}`

function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function getAncestorIds(pages: Page[], pageId: string): string[] {
  const ids: string[] = []
  let current = pages.find(p => p.id === pageId)
  while (current?.parent_id) {
    ids.push(current.parent_id)
    current = pages.find(p => p.id === current!.parent_id)
  }
  return ids
}

function PagePickerModal({ pages, onSelect, onClose, onCloseSplit, hideCloseSplit }: {
  pages: Page[]
  onSelect: (p: Page) => void
  onClose: () => void
  onCloseSplit: () => void
  hideCloseSplit?: boolean
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const allActive = pages.filter(p => !p.deleted_at)
  const nonJournal = allActive.filter(p => p.type !== 'journal')
  const journal = allActive.filter(p => p.type === 'journal')

  const favorites = nonJournal
    .filter(p => p.favorite)
    .sort((a, b) => (a.favorite_position ?? 999) - (b.favorite_position ?? 999))

  const recentPages = [...nonJournal]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 7)

  const recentJournal = [...journal]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const hasQuery = query.trim().length > 0
  const filtered = hasQuery
    ? allActive.filter(p => normalizeStr(p.title || '').includes(normalizeStr(query)))
    : []

  function PageRow({ p }: { p: Page }) {
    return (
      <button
        key={p.id}
        onClick={() => onSelect(p)}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span className="flex-shrink-0">{p.icon || (p.type === 'journal' ? '📝' : '📄')}</span>
        <span className="flex-1 truncate">{p.title || 'Sans titre'}</span>
        {p.type === 'journal' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>Journal</span>
        )}
      </button>
    )
  }

  function SectionLabel({ label }: { label: string }) {
    return (
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{ width: 420, maxHeight: '72vh', background: 'var(--card-bg)', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', border: '1px solid var(--border)' }}
      >
        <div className="px-4 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <i className="ti ti-search" style={{ color: 'var(--text-muted)', fontSize: '15px' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une page…"
            className="flex-1 outline-none text-sm"
            style={{ color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', caretColor: 'var(--accent)', background: 'transparent' }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>Esc</kbd>
        </div>

        <div className="overflow-y-auto flex-1 pb-1">
          {hasQuery ? (
            filtered.length === 0
              ? <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Aucune page trouvée</p>
              : filtered.map(p => <PageRow key={p.id} p={p} />)
          ) : (
            <>
              {favorites.length > 0 && (
                <>
                  <SectionLabel label="Favoris" />
                  {favorites.map(p => <PageRow key={p.id} p={p} />)}
                </>
              )}
              {recentPages.length > 0 && (
                <>
                  <SectionLabel label="Récemment modifiés" />
                  {recentPages.map(p => <PageRow key={p.id} p={p} />)}
                </>
              )}
              {recentJournal.length > 0 && (
                <>
                  <SectionLabel label="Dernières entrées journal" />
                  {recentJournal.map(p => <PageRow key={p.id} p={p} />)}
                </>
              )}
            </>
          )}
        </div>

        {!hideCloseSplit && (
          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={onCloseSplit}
              className="w-full text-sm py-2 rounded-lg"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <i className="ti ti-layout-columns-off mr-2" />
              Fermer la vue partagée
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MoveToModal ──────────────────────────────────────────────────────────────
function MoveToModal({ page, pages, onMove, onClose }: {
  page: Page
  pages: Page[]
  onMove: (parentId: string | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function getDescendantIds(id: string): string[] {
    const children = pages.filter(p => p.parent_id === id && !p.deleted_at)
    return children.flatMap(c => [c.id, ...getDescendantIds(c.id)])
  }
  const excluded = new Set([page.id, ...getDescendantIds(page.id)])
  const candidates = pages.filter(p => !p.deleted_at && p.type !== 'journal' && !excluded.has(p.id))
  const filtered = query.trim()
    ? candidates.filter(p => normalizeStr(p.title || '').includes(normalizeStr(query)))
    : candidates.slice(0, 12)

  function Row({ p }: { p: Page }) {
    return (
      <button onClick={() => onMove(p.id)}
        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <span className="flex-shrink-0">{p.icon || '📄'}</span>
        <span className="flex-1 truncate">{p.title || 'Sans titre'}</span>
        {p.parent_id && <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>sous-page</span>}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex flex-col rounded-2xl overflow-hidden"
        style={{ width: 400, maxHeight: '66vh', background: 'var(--card-bg)', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', border: '1px solid var(--border)' }}>
        <div className="px-4 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <i className="ti ti-folder-symlink" style={{ color: 'var(--text-muted)', fontSize: '15px' }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Déplacer vers…"
            className="flex-1 outline-none text-sm"
            style={{ color: 'var(--text-primary)', WebkitTextFillColor: 'var(--text-primary)', caretColor: 'var(--accent)', background: 'transparent' }} />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>Esc</kbd>
        </div>
        <div className="overflow-y-auto flex-1 pb-1">
          <button onClick={() => onMove(null)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left"
            style={{ color: 'var(--accent)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <i className="ti ti-home text-base flex-shrink-0" />
            <span>Aucun parent (page racine)</span>
          </button>
          <div style={{ height: '1px', background: 'var(--border)', margin: '2px 16px' }} />
          {filtered.length === 0
            ? <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Aucune page trouvée</p>
            : filtered.map(p => <Row key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  )
}

// ─── SidebarContextMenu ───────────────────────────────────────────────────────
function SidebarContextMenu({ x, y, page, isFavorite, onClose, onOpenSplit, onAddSubpage, onMoveTo, onDuplicate, onRename, onToggleFavorite, onTrash }: {
  x: number; y: number; page: Page; isFavorite: boolean
  onClose: () => void
  onOpenSplit: () => void
  onAddSubpage: () => void
  onMoveTo: () => void
  onDuplicate: () => void
  onRename: () => void
  onToggleFavorite: () => void
  onTrash: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    setTimeout(() => document.addEventListener('mousedown', handle), 0)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  // Clamp to viewport
  const menuW = 220, menuH = 280
  const cx = Math.min(x, window.innerWidth - menuW - 8)
  const cy = Math.min(y, window.innerHeight - menuH - 8)

  function Item({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
    return (
      <button onClick={() => { onClick(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
        style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.08)' : 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <i className={`ti ti-${icon}`} style={{ fontSize: '14px', width: '16px', flexShrink: 0 }} />
        {label}
      </button>
    )
  }
  function Sep() {
    return <div style={{ height: '1px', background: 'var(--border)', margin: '3px 8px' }} />
  }

  return (
    <div ref={menuRef}
      className="fixed z-[500] rounded-xl py-1.5 overflow-hidden"
      style={{ left: cx, top: cy, width: menuW, background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)' }}>
      <div className="px-3 py-1.5 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
        {page.icon || '📄'} {page.title || 'Sans titre'}
      </div>
      <Sep />
      <Item icon="layout-columns" label="Ouvrir en vue partagée" onClick={onOpenSplit} />
      <Sep />
      <Item icon="file-plus" label="Ajouter une sous-page" onClick={onAddSubpage} />
      <Item icon="folder-symlink" label="Déplacer vers…" onClick={onMoveTo} />
      <Item icon="copy" label="Dupliquer" onClick={onDuplicate} />
      <Sep />
      <Item icon={isFavorite ? 'star-off' : 'star'} label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={onToggleFavorite} />
      <Sep />
      <Item icon="trash" label="Déplacer vers la corbeille" onClick={onTrash} danger />
    </div>
  )
}

export default function App({ initialPages, userId, userEmail, initialPageId }: { initialPages: Page[], userId: string, userEmail?: string, initialPageId?: string }) {
  const [pages, setPages] = useState<Page[]>(initialPages)
  const [saving, setSaving] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [showJournal, setShowJournal] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [tagsInitialTag, setTagsInitialTag] = useState<string | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const { theme, setTheme } = useTheme()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageId: string } | null>(null)
  const [moveToPageId, setMoveToPageId] = useState<string | null>(null)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overPosition, setOverPosition] = useState<'before' | 'after' | 'inside' | null>(null)
  const [splitMode, setSplitMode] = useState(false)
  const [selectedRight, setSelectedRight] = useState<Page | null>(null)
  const [scrolledPastRight, setScrolledPastRight] = useState(false)
  const [pagePicker, setPagePicker] = useState<'left' | 'right' | null>(null)
  const [showCmdPalette, setShowCmdPalette] = useState(false)
  const lastSaveRef = useRef(0)
  const addingPageRef = useRef(false)
  // Swipe-back depuis le bord gauche (mobile)
  const swipeTouchStartX = useRef(0)
  const swipeTouchStartY = useRef(0)
  function onSwipeTouchStart(e: React.TouchEvent) {
    swipeTouchStartX.current = e.touches[0].clientX
    swipeTouchStartY.current = e.touches[0].clientY
  }
  function onSwipeTouchEnd(e: React.TouchEvent) {
    if (!isMobile || !selected) return
    const dx = e.changedTouches[0].clientX - swipeTouchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - swipeTouchStartY.current)
    if (swipeTouchStartX.current < 40 && dx > 72 && dy < 80) {
      setSelected(null)
    }
  }
  const pointerYRef = useRef(0)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverOverIdRef = useRef<string | null>(null)
  const searchBarRef = useRef<{ focus: () => void }>(null)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  const mainScrollRefRight = useRef<HTMLDivElement>(null)
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
  const SIDEBAR_MIN = 200
  const SIDEBAR_MAX = 420
  const SIDEBAR_DEFAULT = 264
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

  const selectPageRight = useCallback((page: Page | null) => {
    setSelectedRight(page)
    setScrolledPastRight(false)
    if (mainScrollRefRight.current) mainScrollRefRight.current.scrollTop = 0
  }, [])

  const selectPage = useCallback((page: Page | null) => {
    setShowSettings(false)
    setShowTemplateModal(false)
    setShowQuickCapture(false)
    setShowTrash(false)
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
  // sticky header : apparaît dès que l'on a scrollé > 80px dans le panneau
  useEffect(() => {
    if (isMobile) return
    const container = mainScrollRef.current
    if (!container) return
    setScrolledPast(container.scrollTop > 80)
    function onScroll() { setScrolledPast(container.scrollTop > 80) }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [selected?.id, isMobile])

  // Reset scroll & sticky on page change
  useEffect(() => {
    setScrolledPast(false)
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0
  }, [selected?.id])

  useEffect(() => {
    setScrolledPastRight(false)
    if (mainScrollRefRight.current) mainScrollRefRight.current.scrollTop = 0
  }, [selectedRight?.id])

  useEffect(() => {
    if (splitMode) {
      setSelectedRight(null)
      setPagePicker('right')
    } else {
      setSelectedRight(null)
      setPagePicker(null)
    }
  }, [splitMode])

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
      // ⌘+K → palette de commandes globale
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); e.stopPropagation(); setShowCmdPalette(true); return
      }
      if (e.key === 'Escape') {
        setShowCmdPalette(false)
        setShowSettings(false)
        setShowTemplateModal(false)
        setShowQuickCapture(false)
        setShowTrash(false)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && confirmDeleteId && (document.activeElement as HTMLElement | null)?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        deletePage(confirmDeleteId)
        setConfirmDeleteId(null)
        return
      }
      // Bare keys — only when not in a text field
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (isTyping()) return
      if (e.key === 'n') { e.preventDefault(); addPage(null) }
      if (e.key === 'j') { e.preventDefault(); addJournalEntry() }
      if (e.key === 'f') { e.preventDefault(); setSidebarHidden(v => !v) }
      if (e.key === 'q') { e.preventDefault(); setShowQuickCapture(true) }
      if (e.key === 's') { e.preventDefault(); setSplitMode(v => !v) }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [addPage, addJournalEntry, confirmDeleteId, deletePage])

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
      if (data) { setPages(prev => [...prev, data]); selectPage(data); setJustCreatedId(data.id); if (parentId) setOpenMap(o => ({ ...o, [parentId]: true })) }
    } finally {
      addingPageRef.current = false
    }
  }

  async function addJournalEntry() {
    const mots = ['Réflexion', 'Fragment', 'Éclat', 'Lueur', 'Souffle', 'Trace', 'Murmure', 'Impression', 'Intuition', 'Instant', 'Étincelle', 'Écho', 'Envol', 'Vibration', 'Pensée', 'Grain', 'Sillon', 'Élancement']
    const title = mots[Math.floor(Math.random() * mots.length)]
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

  function syncSelectedPage(id: string, patch: Partial<Page>) {
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } : null)
    if (selectedRight?.id === id) setSelectedRight(prev => prev ? { ...prev, ...patch } : null)
  }

  async function updateTitle(value: string, pageId: string) {
    const page = pages.find(p => p.id === pageId)
    if (!page) return
    const updated_at = new Date().toISOString()
    syncSelectedPage(pageId, { title: value, updated_at })
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, title: value, updated_at } : p))
    setSaving(true)
    try {
      const { error } = await createClient().from('pages').update({ title: value, updated_at }).eq('id', pageId)
      if (error) throw error
    } catch {
      toast('Erreur de sauvegarde — vérifiez votre connexion.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function updateIcon(id: string, icon: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, icon } : p))
    syncSelectedPage(id, { icon })
    await createClient().from('pages').update({ icon }).eq('id', id)
  }

  async function updateTags(id: string, tags: string[]) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, tags } : p))
    syncSelectedPage(id, { tags })
    await createClient().from('pages').update({ tags }).eq('id', id)
  }

  async function updateCreatedAt(id: string, iso: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, created_at: iso } : p))
    syncSelectedPage(id, { created_at: iso })
    await createClient().from('pages').update({ created_at: iso }).eq('id', id)
  }

  async function renamePage(id: string, title: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, title } : p))
    syncSelectedPage(id, { title })
    await createClient().from('pages').update({ title }).eq('id', id)
  }

  async function movePage(id: string, newParentId: string | null) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, parent_id: newParentId } : p))
    syncSelectedPage(id, { parent_id: newParentId })
    if (newParentId) setOpenMap(o => ({ ...o, [newParentId]: true }))
    await createClient().from('pages').update({ parent_id: newParentId }).eq('id', id)
    toast('Page déplacée.', 'success')
  }

  async function duplicatePage(id: string) {
    const page = pages.find(p => p.id === id)
    if (!page) return
    const { data } = await createClient().from('pages')
      .insert({ title: (page.title || 'Sans titre') + ' (copie)', content: page.content, user_id: userId, parent_id: page.parent_id, position: page.position + 0.5, icon: page.icon, type: page.type })
      .select().single()
    if (data) { setPages(prev => [...prev, data]); selectPage(data); setJustCreatedId(data.id) }
  }

  async function updateContent(content: string, pageId?: string) {
    const targetId = pageId ?? selected?.id
    if (!targetId) return
    const page = pages.find(p => p.id === targetId)
    if (!page) return
    const updated_at = new Date().toISOString()
    syncSelectedPage(targetId, { content, updated_at })
    setPages(prev => prev.map(p => p.id === targetId ? { ...p, content, updated_at } : p))
    setSaving(true)
    try {
      const { error } = await createClient().from('pages').update({ content, updated_at }).eq('id', targetId)
      if (error) throw error
      const now = Date.now()
      if (now - lastSaveRef.current > 2 * 60 * 1000) {
        lastSaveRef.current = now
        await createClient().from('page_history').insert({ page_id: targetId, user_id: userId, title: page.title, content })
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
    if (selectedRight?.id === id) setSelectedRight(null)
    toast('Déplacé dans la corbeille.', 'info', { label: 'Annuler', onAction: () => restorePage(id) })
    await createClient().from('pages').update({ deleted_at: deletedAt }).eq('id', id)
    const children = pages.filter(p => p.parent_id === id)
    if (children.length) await createClient().from('pages').update({ deleted_at: deletedAt }).in('id', children.map(c => c.id))
  }

  async function restorePage(id: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, deleted_at: null } : p))
    await createClient().from('pages').update({ deleted_at: null }).eq('id', id)
    toast('Note restaurée.', 'success')
  }

  async function deleteForever(id: string) {
    setPages(prev => prev.filter(p => p.id !== id))
    await createClient().from('pages').delete().eq('id', id)
    toast('Supprimée définitivement.', 'info')
  }

  async function logout() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  async function importPages(imported: Omit<Page, 'user_id'>[]) {
    let count = 0, errors = 0
    for (const p of imported) {
      const { data, error } = await createClient().from('pages')
        .upsert({ ...p, user_id: userId }, { onConflict: 'id', ignoreDuplicates: false })
        .select().single()
      if (error || !data) { errors++; continue }
      setPages(prev => {
        const exists = prev.find(x => x.id === data.id)
        return exists ? prev.map(x => x.id === data.id ? data : x) : [...prev, data]
      })
      count++
    }
    return { count, errors }
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
        // Après 400ms sur le même item → inside + auto-expand
        if (hoverOverIdRef.current === overId) {
          setOverPosition('inside')
          setOpenMap(o => ({ ...o, [overId]: true }))
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
  const subpagesRight = selectedRight ? activePages.filter(p => p.parent_id === selectedRight.id) : []
  const journalSubpages = selected ? journalEntries.filter(p => p.parent_id === selected.id) : []
  const journalSubpagesRight = selectedRight ? journalEntries.filter(p => p.parent_id === selectedRight.id) : []
  const showingJournalDesktop = !isMobile && showJournal && !selected
  const showingTagsDesktop = !isMobile && showTags && !selected
  const showingRecentDesktop = !isMobile && showRecent && !selected
  const showingReviewDesktop = !isMobile && showReview && !selected

  function closeSplit() {
    setSplitMode(false)
    setSelectedRight(null)
    setPagePicker(null)
  }

  function handlePickerSelect(page: Page) {
    if (pagePicker === 'right') {
      setSelectedRight(page)
    } else if (pagePicker === 'left') {
      selectPage(page)
    }
    setPagePicker(null)
  }

  if (!mounted) {
    return <div style={{ position: 'fixed', inset: 0, background: '#f0f0ec' }} />
  }

  const sidebarHiddenEff = sidebarHidden

  return (
    <div className="flex w-full h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>

      {/* ── Sidebar desktop ── */}
      <div
        className="hidden md:flex flex-col flex-shrink-0 relative overflow-hidden"
        style={{
          width: sidebarHiddenEff ? 0 : `${sidebarWidth}px`,
          background: 'var(--sidebar-bg)',
          borderRight: sidebarHiddenEff ? 'none' : '1px solid var(--sidebar-border)',
          transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)',
          minWidth: 0,
        }}
      >
        <div onMouseDown={startResize} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors" onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Redimensionner">
          <div className="absolute right-0 top-0 bottom-0 w-4 -translate-x-1.5" />
        </div>

        {/* Header */}
        <div className="px-3 flex items-center justify-between gap-2" style={{ minHeight: '52px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <img src="/apple-touch-icon.png" alt="Idée" className="w-6 h-6 rounded-lg flex-shrink-0" />
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '17px', fontWeight: 700, color: 'var(--sidebar-fg)', letterSpacing: '-0.01em', lineHeight: 1 }}>
              Idée
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setSidebarHidden(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--sidebar-icon)', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--sidebar-fg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-icon)' }}
              title="Masquer la sidebar"
            >
              <i className="ti ti-layout-sidebar-left-collapse" style={{ fontSize: '14px' }} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--sidebar-icon)', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--sidebar-fg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-icon)' }}
              title="Paramètres"
            >
              <i className="ti ti-settings" style={{ fontSize: '15px' }} />
            </button>
          </div>
        </div>

        {/* Bouton nouvelle page — au dessus de la recherche */}
        <div className="px-2 pt-2 pb-1">
          <button
            onClick={() => showJournal ? addJournalEntry() : setShowTemplateModal(true)}
            className="w-full relative flex items-center justify-center gap-2 px-3 rounded-xl text-sm font-medium transition-colors"
            style={{ height: '40px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}
            title={showJournal ? 'Nouvelle entrée — touche J' : 'Nouvelle page — touche N'}
          >
            <span className="flex items-center justify-center" style={{ fontSize: '15px' }}>{showJournal ? <i className="ti ti-pencil" /> : <i className="ti ti-plus" />}</span>
            <span>{showJournal ? 'Nouvelle entrée' : 'Nouvelle page'}</span>
            <kbd className="absolute text-[10px] px-1.5 py-0.5 rounded font-mono opacity-60" style={{ right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
              {showJournal ? 'J' : 'N'}
            </kbd>
          </button>
        </div>

        <SearchBar ref={searchBarRef} pages={[...activePages, ...journalEntries]} onSelect={selectPage} />
        <div className="flex px-2 pt-1 pb-1 gap-1 flex-shrink-0">
          <button
            onClick={() => { setShowSettings(false); setShowTemplateModal(false); setShowQuickCapture(false); setShowJournal(false); setShowTags(false); setShowRecent(false); setShowReview(false); setSelected(s => s?.type === 'journal' ? null : s) }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: !showJournal && !showTags && !showRecent && !showReview ? 'var(--sidebar-selected)' : 'transparent',
              color: !showJournal && !showTags && !showRecent && !showReview ? 'var(--sidebar-selected-fg)' : 'var(--sidebar-muted)',
            }}
            onMouseEnter={e => { if (showJournal || showTags || showRecent || showReview) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = !showJournal && !showTags && !showRecent && !showReview ? 'var(--sidebar-selected)' : 'transparent' }}
          >
            <i className="ti ti-file-text" style={{ fontSize: '15px', flexShrink: 0 }} /><span>Notes</span>
          </button>
          <button
            onClick={() => { setShowSettings(false); setShowTemplateModal(false); setShowQuickCapture(false); setShowJournal(true); setShowTags(false); setShowRecent(false); setShowReview(false); setSelected(null) }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: showJournal ? 'var(--sidebar-selected)' : 'transparent',
              color: showJournal ? 'var(--sidebar-selected-fg)' : 'var(--sidebar-muted)',
            }}
            onMouseEnter={e => { if (!showJournal) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = showJournal ? 'var(--sidebar-selected)' : 'transparent' }}
          >
            <i className="ti ti-book" style={{ fontSize: '15px', flexShrink: 0 }} /><span>Journal</span>
            {journalEntries.length > 0 && <span className="text-[10px] opacity-60">{journalEntries.length}</span>}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 sidebar-scroll">
          {activePages.filter(p => p.parent_id === null).length === 0 && (
            <p className="text-xs px-3 py-3" style={{ color: 'var(--sidebar-muted)' }}>Clique sur + pour créer une page.</p>
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
            onContextMenu={(e, id) => setContextMenu({ x: e.clientX, y: e.clientY, pageId: id })}
          />
          {/* Pages récentes */}
          {(() => {
            const recent = [...pages]
              .filter(p => !p.deleted_at)
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
              .slice(0, 4)
            if (recent.length === 0) return null
            return (
              <div className="mb-1">
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--sidebar-muted)' }}>Récents</p>
                {recent.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { selectPage(p); if (p.type === 'journal') setShowJournal(true) }}
                    onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, pageId: p.id }) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm truncate transition-colors"
                    style={{
                      background: selected?.id === p.id ? 'var(--sidebar-selected)' : 'transparent',
                      color: selected?.id === p.id ? 'var(--sidebar-selected-fg)' : 'var(--sidebar-muted)',
                    }}
                    onMouseEnter={e => { if (selected?.id !== p.id) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = selected?.id === p.id ? 'var(--sidebar-selected)' : 'transparent' }}
                  >
                    <span className="text-sm flex-shrink-0">{p.icon || (p.type === 'journal' ? '📝' : '📄')}</span>
                    <span className="truncate text-xs">{p.title || 'Sans titre'}</span>
                  </button>
                ))}
              </div>
            )
          })()}
          <div style={{ height: '1px', background: 'var(--sidebar-border)', margin: '4px 12px 6px' }} />
          <DndContext
            sensors={sensors}
            collisionDetection={closestVertical}
            autoScroll={{ enabled: true, threshold: { x: 0, y: 0.12 } }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <PageTree pages={activePages} parentId={null} depth={0} selectedId={selected?.id || null}
              onSelect={selectPage} onAdd={addPage} onToggle={toggleOpen} openMap={openMap}
              overId={overId} overPosition={overPosition} isMobile={false}
              onRename={renamePage} onToggleFavorite={toggleFavorite}
              onContextMenu={(e, id) => setContextMenu({ x: e.clientX, y: e.clientY, pageId: id })} />
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
        <div className="flex-shrink-0 px-2 py-2 space-y-1" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          {/* Tags — toujours visible */}
          <button
            onClick={() => { setShowSettings(false); setShowTemplateModal(false); setShowQuickCapture(false); setShowTags(true); setTagsInitialTag(undefined); setShowJournal(false); setShowRecent(false); setShowReview(false); setSelected(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{
              background: showTags ? 'var(--sidebar-selected)' : 'transparent',
              color: showTags ? 'var(--sidebar-selected-fg)' : 'var(--sidebar-muted)',
            }}
            onMouseEnter={e => { if (!showTags) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = showTags ? 'var(--sidebar-selected)' : 'transparent' }}
          >
            <i className="ti ti-tag" style={{ fontSize: '15px', flexShrink: 0 }} />
            <span className="flex-1 text-left">Tags</span>
            {Array.from(new Set([...activePages, ...journalEntries].flatMap(p => p.tags || []))).length > 0 && (
              <span className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>
                {Array.from(new Set([...activePages, ...journalEntries].flatMap(p => p.tags || []))).length}
              </span>
            )}
          </button>
          {/* Corbeille — toujours visible */}
          <button
            onClick={() => setShowTrash(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{ color: 'var(--sidebar-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <i className="ti ti-trash" style={{ fontSize: '15px', flexShrink: 0 }} /><span className="flex-1 text-left">Corbeille</span>
            {trashedPages.length > 0 && <span className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>{trashedPages.length}</span>}
          </button>
          {/* Plus — replie le reste */}
          <button
            onClick={() => setShowMore(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{ color: (showMore || showRecent || showReview) ? 'var(--sidebar-fg)' : 'var(--sidebar-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <i className="ti ti-dots" style={{ fontSize: '15px', flexShrink: 0 }} />
            <span className="flex-1 text-left">Plus</span>
            <i className={`ti ${(showMore || showRecent || showReview) ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: '12px', opacity: 0.5 }} />
          </button>
          {(showMore || showRecent || showReview) && (
            <div className="space-y-0.5 pl-2">
              <button
                onClick={() => setShowQuickCapture(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{ color: 'var(--sidebar-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="Capture rapide — touche Q"
              >
                <i className="ti ti-bolt" style={{ fontSize: '14px', flexShrink: 0 }} />
                <span className="flex-1 text-left">Capture rapide</span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--sidebar-hover)', color: 'var(--sidebar-muted)', border: '1px solid var(--sidebar-border)' }}>Q</kbd>
              </button>
              <button
                onClick={() => setSplitMode(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{ background: splitMode ? 'var(--sidebar-selected)' : 'transparent', color: splitMode ? 'var(--sidebar-selected-fg)' : 'var(--sidebar-muted)' }}
                onMouseEnter={e => { if (!splitMode) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = splitMode ? 'var(--sidebar-selected)' : 'transparent' }}
                title="Vue partagée — touche S"
              >
                <i className="ti ti-layout-columns" style={{ fontSize: '14px', flexShrink: 0 }} />
                <span className="flex-1 text-left">Vue partagée</span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--sidebar-hover)', color: 'var(--sidebar-muted)', border: '1px solid var(--sidebar-border)' }}>S</kbd>
              </button>
              <button
                onClick={() => { setShowSettings(false); setShowTemplateModal(false); setShowQuickCapture(false); setShowRecent(true); setShowReview(false); setShowJournal(false); setShowTags(false); setSelected(null) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{ background: showRecent ? 'var(--sidebar-selected)' : 'transparent', color: showRecent ? 'var(--sidebar-selected-fg)' : 'var(--sidebar-muted)' }}
                onMouseEnter={e => { if (!showRecent) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = showRecent ? 'var(--sidebar-selected)' : 'transparent' }}
              >
                <i className="ti ti-clock-hour-9" style={{ fontSize: '14px', flexShrink: 0 }} /><span className="flex-1 text-left">Vue récente</span>
              </button>
              <button
                onClick={() => { setShowSettings(false); setShowTemplateModal(false); setShowQuickCapture(false); setShowReview(true); setShowRecent(false); setShowJournal(false); setShowTags(false); setSelected(null) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{ background: showReview ? 'var(--sidebar-selected)' : 'transparent', color: showReview ? 'var(--sidebar-selected-fg)' : 'var(--sidebar-muted)' }}
                onMouseEnter={e => { if (!showReview) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = showReview ? 'var(--sidebar-selected)' : 'transparent' }}
              >
                <i className="ti ti-refresh" style={{ fontSize: '14px', flexShrink: 0 }} /><span className="flex-1 text-left">Réviser</span>
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{ color: 'var(--sidebar-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <i className="ti ti-clock-hour-4" style={{ fontSize: '14px', flexShrink: 0 }} /><span className="flex-1 text-left">Historique</span>
              </button>
            </div>
          )}
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
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onLogout={logout} onImport={importPages} pages={pages} userId={userId} userEmail={userEmail} />}
      {showHistory && <HistoryModal pages={pages} onClose={() => setShowHistory(false)} onNavigate={p => { selectPage(p); setShowHistory(false); setShowJournal(p.type === 'journal') }} />}
      {/* ── Desktop : vue journal ── */}
      {showingJournalDesktop && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <JournalList entries={journalEntries} selectedId={null} onSelect={p => { selectPage(p); setShowJournal(false) }} onAdd={addJournalEntry} />
        </div>
      )}

      {/* ── Desktop : vue tags ── */}
      {showingTagsDesktop && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TagsView pages={[...activePages, ...journalEntries]} onSelect={p => { selectPage(p); setShowTags(false); if (p.type === 'journal') setShowJournal(true) }} initialTag={tagsInitialTag} />
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
          onClick={() => setSidebarHidden(v => !v)}
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
          <i className="ti ti-layout-sidebar" style={{ fontSize: '13px' }} />
        </button>
      )}

      {/* ── Contenu principal ── */}
      <div className={`${(isMobile && !selected) || showingJournalDesktop || showingTagsDesktop || showingRecentDesktop || showingReviewDesktop ? 'hidden' : ''} flex-1 flex overflow-hidden min-w-0`}
        onTouchStart={onSwipeTouchStart} onTouchEnd={onSwipeTouchEnd}>
        {/* Panneau gauche */}
        <div ref={mainScrollRef} className="flex-1 overflow-y-auto min-w-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 48px)' }}>
          {splitMode && (
            <div className="sticky top-0 z-30 flex items-center justify-end gap-1 px-2 py-1" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
              <button onClick={() => setPagePicker('left')} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Changer la page">
                <i className="ti ti-arrows-exchange" style={{ fontSize: '14px' }} />
              </button>
              <button onClick={closeSplit} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Fermer la vue partagée">
                <i className="ti ti-layout-columns-off" style={{ fontSize: '14px' }} />
              </button>
            </div>
          )}
          {selected ? (
            <>
              {scrolledPast && !isMobile && (
                <>
                  <style>{`@keyframes _shi{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
                  <div className="sticky top-0 z-20 flex items-center gap-1 px-2"
                    style={{ height: '44px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', animation: '_shi 180ms ease both' }}>
                    {selected.type === 'journal' ? (
                      <>
                        <button
                          onClick={() => { setSelected(null); setShowJournal(true) }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 transition-colors"
                          style={{ color: 'var(--accent)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M5 1L1 5l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Journal
                        </button>
                        <span style={{ color: 'var(--text-faint)' }}>/</span>
                        <span className="text-sm font-medium truncate px-1" style={{ color: 'var(--text-primary)' }}>
                          {selected.title || 'Sans titre'}
                        </span>
                      </>
                    ) : (() => {
                      const parent = selected.parent_id ? activePages.find(p => p.id === selected.parent_id) : null
                      return parent ? (
                        <>
                          <button
                            onClick={() => selectPage(parent)}
                            className="px-2 py-1 rounded-lg text-xs transition-colors flex-shrink-0 truncate max-w-[140px]"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            {parent.title || 'Sans titre'}
                          </button>
                          <span style={{ color: 'var(--text-faint)' }}>/</span>
                          <span className="text-sm font-medium truncate px-1" style={{ color: 'var(--text-primary)' }}>
                            {selected.title || 'Sans titre'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-lg flex-shrink-0 px-1">{selected.icon || '📄'}</span>
                          <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                            {selected.title || 'Sans titre'}
                          </span>
                        </>
                      )
                    })()}
                  </div>
                </>
              )}
              <div
                className={`page-card relative z-10 mx-3 md:mx-auto mb-6 flex flex-col${selected.id === justCreatedId ? ' page-new-enter' : ''}`}
                onAnimationEnd={() => setJustCreatedId(null)}
              >
                <MobileTopBar
                  onBack={() => {
                    if (selected.type === 'journal') { setSelected(null); setShowJournal(true) }
                    else setSelected(null)
                  }}
                  backLabel={selected.type === 'journal' ? 'Journal' : 'Pages'}
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
                  onTitleChange={v => updateTitle(v, selected.id)}
                  onIconChange={emoji => updateIcon(selected.id, emoji)}
                  onTagsChange={tags => updateTags(selected.id, tags)}
                  onToggleFavorite={toggleFavorite}
                  onDelete={() => setConfirmDeleteId(selected.id)}
                  onConvertToJournal={() => convertToJournal(selected.id)}
                  onCreatedAtChange={iso => updateCreatedAt(selected.id, iso)}
                  onRestore={(title, content) => {
                    syncSelectedPage(selected.id, { title, content })
                    setPages(prev => prev.map(p => p.id === selected.id ? { ...p, title, content } : p))
                  }}
                  onShareUpdate={updates => {
                    syncSelectedPage(selected.id, updates)
                    setPages(prev => prev.map(p => p.id === selected.id ? { ...p, ...updates } : p))
                  }}
                  onSummaryUpdate={summary => {
                    syncSelectedPage(selected.id, { summary: summary ?? undefined })
                    setPages(prev => prev.map(p => p.id === selected.id ? { ...p, summary: summary ?? undefined } : p))
                  }}
                  onTagClick={tag => { setTagsInitialTag(tag); setShowTags(true); setShowJournal(false); setShowRecent(false); setShowReview(false); setSelected(null) }}
                />
                {selected.type !== 'journal' && (
                  <SubpagesList
                    page={selected}
                    subpages={subpages}
                    journalSubpages={journalSubpages}
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
                  onUpdate={content => updateContent(content, selected.id)}
                  onAddSubpage={() => addPage(selected.id)}
                  onNavigate={p => { selectPage(p); if (p.type === 'journal') setShowJournal(false) }}
                  userId={userId}
                  isMobile={isMobile}
                  focusMode={sidebarHidden}
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

        {/* Séparateur + panneau droit (vue partagée) */}
        {splitMode && !isMobile && (
          <>
            <div style={{ width: '1px', flexShrink: 0, background: 'var(--border)' }} />
            <div ref={mainScrollRefRight} className="flex-1 overflow-y-auto min-w-0 pb-12">
              <div className="sticky top-0 z-30 flex items-center justify-end gap-1 px-2 py-1" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
                <button onClick={() => setPagePicker('right')} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Changer la page">
                  <i className="ti ti-arrows-exchange" style={{ fontSize: '14px' }} />
                </button>
                <button onClick={closeSplit} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} title="Fermer la vue partagée">
                  <i className="ti ti-layout-columns-off" style={{ fontSize: '14px' }} />
                </button>
              </div>
              {selectedRight ? (
                <div className="page-card relative z-10 mx-3 md:mx-auto mb-6 flex flex-col">
                  <PageHeader
                    page={selectedRight}
                    pages={[...activePages, ...journalEntries]}
                    userId={userId}
                    saving={saving}
                    isMobile={false}
                    onBack={() => setSelectedRight(null)}
                    onSelectPage={selectPageRight}
                    onTitleChange={v => updateTitle(v, selectedRight.id)}
                    onIconChange={emoji => updateIcon(selectedRight.id, emoji)}
                    onTagsChange={tags => updateTags(selectedRight.id, tags)}
                    onToggleFavorite={toggleFavorite}
                    onDelete={() => setConfirmDeleteId(selectedRight.id)}
                    onConvertToJournal={() => convertToJournal(selectedRight.id)}
                    onCreatedAtChange={iso => updateCreatedAt(selectedRight.id, iso)}
                    onRestore={(title, content) => {
                      syncSelectedPage(selectedRight.id, { title, content })
                      setPages(prev => prev.map(p => p.id === selectedRight.id ? { ...p, title, content } : p))
                    }}
                    onShareUpdate={updates => {
                      syncSelectedPage(selectedRight.id, updates)
                      setPages(prev => prev.map(p => p.id === selectedRight.id ? { ...p, ...updates } : p))
                    }}
                    onSummaryUpdate={summary => {
                      syncSelectedPage(selectedRight.id, { summary: summary ?? undefined })
                      setPages(prev => prev.map(p => p.id === selectedRight.id ? { ...p, summary: summary ?? undefined } : p))
                    }}
                  />
                  {selectedRight.type !== 'journal' && (
                    <SubpagesList
                      page={selectedRight}
                      subpages={subpagesRight}
                      journalSubpages={journalSubpagesRight}
                      onSelect={selectPageRight}
                      onReorder={(a, o, p) => reorderSiblings(a, o, p)}
                      isMobile={false}
                      onAddSubpage={() => addPage(selectedRight.id)}
                    />
                  )}
                  <Editor
                    key={`right-${selectedRight.id}`}
                    page={selectedRight}
                    pages={[...activePages, ...journalEntries]}
                    onUpdate={content => updateContent(content, selectedRight.id)}
                    onAddSubpage={() => addPage(selectedRight.id)}
                    onNavigate={p => selectPageRight(p)}
                    userId={userId}
                    isMobile={false}
                    focusMode={false}
                  />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center h-full min-h-[50vh]">
                  <div className="text-center">
                    <p className="text-3xl mb-3">📄</p>
                    <p className="text-sm font-medium mb-2" style={{ color: 'var(--empty-title)' }}>Aucune page sélectionnée</p>
                    <button
                      onClick={() => setPagePicker('right')}
                      className="text-sm px-4 py-2 rounded-xl"
                      style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)' }}
                    >
                      Choisir une page
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
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
      {pagePicker && (
        <PagePickerModal
          pages={[...activePages, ...journalEntries]}
          onSelect={handlePickerSelect}
          onClose={() => {
            if (pagePicker === 'right' && !selectedRight) closeSplit()
            else setPagePicker(null)
          }}
          onCloseSplit={closeSplit}
        />
      )}
      {showCmdPalette && (
        <PagePickerModal
          pages={[...activePages, ...journalEntries]}
          onSelect={p => { selectPage(p); setShowCmdPalette(false) }}
          onClose={() => setShowCmdPalette(false)}
          onCloseSplit={() => setShowCmdPalette(false)}
          hideCloseSplit
        />
      )}
      {contextMenu && (() => {
        const page = pages.find(p => p.id === contextMenu.pageId)
        if (!page) return null
        return (
          <SidebarContextMenu
            x={contextMenu.x} y={contextMenu.y}
            page={page}
            isFavorite={!!page.favorite}
            onClose={() => setContextMenu(null)}
            onOpenSplit={() => { setSplitMode(true); setSelectedRight(page) }}
            onAddSubpage={() => { addPage(page.id); setOpenMap(o => ({ ...o, [page.id]: true })) }}
            onMoveTo={() => { setMoveToPageId(page.id); setContextMenu(null) }}
            onDuplicate={() => duplicatePage(page.id)}
            onRename={() => {
              // déclenche inline rename via double-clic simulé sur l'item
              const el = document.querySelector(`[data-page-rename="${page.id}"]`) as HTMLElement | null
              el?.click()
            }}
            onToggleFavorite={() => toggleFavorite(page.id)}
            onTrash={() => setConfirmDeleteId(page.id)}
          />
        )
      })()}
      {moveToPageId && (() => {
        const page = pages.find(p => p.id === moveToPageId)
        if (!page) return null
        return (
          <MoveToModal
            page={page}
            pages={activePages}
            onMove={parentId => { movePage(moveToPageId, parentId); setMoveToPageId(null) }}
            onClose={() => setMoveToPageId(null)}
          />
        )
      })()}
      <Toaster />
    </div>
  )
}
