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
import { PAGE_META_COLUMNS } from '@/lib/pageColumns'
import { getAncestorIds, getDescendantIds, slugify, extractStoragePaths } from './utils'
import { useIsMobile, useToggleFavorite, usePageSaver, useRealtimePages } from './hooks'
import { PagePickerModal } from './components/PagePickerModal'
import { MoveToModal } from './components/MoveToModal'
import { SidebarContextMenu } from './components/SidebarContextMenu'
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

// Placeholder affiché le temps que le corps d'une note se charge (fenêtre
// très courte : hydratation de fond ou fetch à la demande).
function ContentLoading({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="py-6" style={{ paddingLeft: isMobile ? 16 : 52, paddingRight: isMobile ? 16 : 52 }}>
      <div className="animate-pulse flex flex-col gap-3" style={{ maxWidth: 720 }}>
        <div style={{ height: 14, width: '85%', borderRadius: 6, background: 'var(--hover-bg)' }} />
        <div style={{ height: 14, width: '70%', borderRadius: 6, background: 'var(--hover-bg)' }} />
        <div style={{ height: 14, width: '78%', borderRadius: 6, background: 'var(--hover-bg)' }} />
      </div>
    </div>
  )
}

export default function App({ initialPages, userId, userEmail, initialPageId }: { initialPages: Page[], userId: string, userEmail?: string, initialPageId?: string }) {
  const [pages, setPages] = useState<Page[]>(initialPages)
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
  const { saveState, queueSave } = usePageSaver(userId, pages)

  // ── Hydratation du contenu ──────────────────────────────────────────────
  // Le serveur ne renvoie pas `content` (sauf pour la page ouverte via l'URL).
  // On garde la trace des pages dont le corps est chargé : au montage, une
  // seule requête récupère tous les contenus en arrière-plan ; une page
  // sélectionnée avant la fin de l'hydratation est chargée à la demande.
  const [hydratedIds, setHydratedIds] = useState<Set<string>>(
    () => new Set(initialPages.filter(p => p.content != null).map(p => p.id))
  )
  const hydratedRef = useRef(hydratedIds)
  useEffect(() => { hydratedRef.current = hydratedIds }, [hydratedIds])

  // Marque une page comme ayant son contenu chargé (nouvelle page, doublon…).
  const markHydrated = useCallback((id: string) => {
    hydratedRef.current = new Set(hydratedRef.current).add(id)
    setHydratedIds(hydratedRef.current)
  }, [])

  // Contenus produits/chargés localement par page : sert à reconnaître l'écho
  // de nos propres sauvegardes Realtime et à ne pas le confondre avec une
  // édition venue d'un autre appareil. Borné aux ~12 dernières valeurs.
  const localContentsRef = useRef<Map<string, string[]>>(new Map())
  const recordLocalContent = useCallback((pageId: string, content: string) => {
    const list = localContentsRef.current.get(pageId) || []
    list.push(content)
    if (list.length > 12) list.shift()
    localContentsRef.current.set(pageId, list)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await createClient().from('pages').select('id, content')
      if (cancelled || error || !data) return
      const byId = new Map(data.map(r => [r.id as string, (r.content ?? '') as string]))
      // On ne remplit que les pages non encore hydratées : ne jamais écraser
      // le contenu d'une page déjà chargée (potentiellement en cours d'édition).
      setPages(prev => prev.map(p =>
        hydratedRef.current.has(p.id) ? p : { ...p, content: byId.get(p.id) ?? '' }
      ))
      // Union (pas remplacement) : ne pas « déshydrater » une page créée
      // pendant la fenêtre de chargement.
      setHydratedIds(new Set([...hydratedRef.current, ...data.map(r => r.id as string)]))
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Charge à la demande le contenu d'une page pas encore hydratée (cas d'une
  // sélection avant la fin de l'hydratation de fond, p. ex. dernière page
  // restaurée depuis localStorage).
  const ensureContent = useCallback(async (pageId: string) => {
    if (hydratedRef.current.has(pageId)) return
    const { data, error } = await createClient().from('pages').select('content').eq('id', pageId).single()
    if (error) return
    const content = data?.content ?? ''
    recordLocalContent(pageId, content)
    hydratedRef.current = new Set(hydratedRef.current).add(pageId)
    setHydratedIds(hydratedRef.current)
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, content } : p))
    setSelected(prev => prev?.id === pageId ? { ...prev, content } : prev)
    setSelectedRight(prev => prev?.id === pageId ? { ...prev, content } : prev)
  }, [recordLocalContent])

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
    try {
      const parsed = parseInt(localStorage.getItem('sidebar_width') || '', 10)
      // Valeur corrompue ou absente → largeur par défaut (sinon width: NaNpx)
      if (Number.isFinite(parsed)) setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, parsed)))
    } catch {}
    setMounted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Synchronisation temps réel (multi-onglets / multi-appareils) ──────────
  // Refs pour lire l'état courant sans réabonner le canal Realtime.
  const pagesRef = useRef(pages)
  useEffect(() => { pagesRef.current = pages }, [pages])
  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected })
  const selectedRightRef = useRef(selectedRight)
  useEffect(() => { selectedRightRef.current = selectedRight })
  // Throttle des notifications « modifiée ailleurs » (une par page / 20 s).
  const externalEditAtRef = useRef<Map<string, number>>(new Map())
  // Pages supprimées localement (corbeille ou définitivement). Un écho Realtime
  // périmé de nos propres écritures (une sauvegarde encore « en vol » au moment
  // de la suppression) porte l'ancien état (deleted_at à null) et ferait
  // « ressusciter » la note. On ignore donc tout événement Realtime pour ces
  // pages, jusqu'à une éventuelle restauration.
  const deletedTombstoneRef = useRef<Set<string>>(new Set())
  // Nonce pour forcer le remount de l'éditeur lors d'un rechargement manuel.
  const [editorNonce, setEditorNonce] = useState(0)

  const reloadPageContent = useCallback(async (pageId: string) => {
    const { data, error } = await createClient().from('pages').select('content').eq('id', pageId).single()
    if (error) return
    const content = data?.content ?? ''
    recordLocalContent(pageId, content)
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, content } : p))
    setSelected(prev => prev?.id === pageId ? { ...prev, content } : prev)
    setSelectedRight(prev => prev?.id === pageId ? { ...prev, content } : prev)
    setEditorNonce(n => n + 1)
  }, [recordLocalContent])

  const applyRemoteUpsert = useCallback((row: Page) => {
    // Ne jamais ressusciter une page supprimée localement via un écho périmé.
    if (deletedTombstoneRef.current.has(row.id)) return
    const existing = pagesRef.current.find(p => p.id === row.id)
    const { content: incoming, ...meta } = row as Page & { content?: string }

    if (!existing) {
      // Page créée sur un autre appareil.
      if (incoming !== undefined) markHydrated(row.id)
      setPages(prev => prev.find(p => p.id === row.id) ? prev : [...prev, row])
      return
    }

    const openHere = selectedRef.current?.id === row.id || selectedRightRef.current?.id === row.id
    const contentDiffers = incoming !== undefined && incoming !== existing.content
    const isOwnEcho = incoming !== undefined && (localContentsRef.current.get(row.id) || []).includes(incoming)

    if (openHere && contentDiffers && !isOwnEcho) {
      // Édition distante d'une note ouverte ici : on ne clobbe jamais
      // l'éditeur. Métadonnées appliquées, contenu conservé, l'utilisateur
      // peut recharger pour voir la dernière version.
      const now = Date.now()
      if (now - (externalEditAtRef.current.get(row.id) || 0) > 20000) {
        externalEditAtRef.current.set(row.id, now)
        toast(`« ${row.title || 'Sans titre'} » a été modifiée sur un autre appareil.`, 'info',
          { label: 'Recharger', onAction: () => void reloadPageContent(row.id) })
      }
      setPages(prev => prev.map(p => p.id === row.id ? { ...p, ...meta } : p))
      setSelected(prev => prev?.id === row.id ? { ...prev, ...meta } : prev)
      setSelectedRight(prev => prev?.id === row.id ? { ...prev, ...meta } : prev)
      return
    }

    // Page non ouverte (ou écho / contenu identique) : on applique tout.
    // Pour une page ouverte dont le contenu ne diffère pas, inutile de
    // toucher au contenu (évite un remount inutile de l'éditeur).
    const applyContent = incoming !== undefined && !openHere
    if (applyContent) markHydrated(row.id)
    setPages(prev => prev.map(p => p.id === row.id
      ? { ...p, ...meta, content: applyContent ? incoming! : p.content }
      : p))
    setSelected(prev => prev?.id === row.id ? { ...prev, ...meta } : prev)
    setSelectedRight(prev => prev?.id === row.id ? { ...prev, ...meta } : prev)
  }, [markHydrated, reloadPageContent])

  const applyRemoteDelete = useCallback((id: string) => {
    if (!pagesRef.current.find(p => p.id === id)) return
    setPages(prev => prev.filter(p => p.id !== id))
    setSelected(prev => prev?.id === id ? null : prev)
    setSelectedRight(prev => prev?.id === id ? null : prev)
  }, [])

  useRealtimePages(userId, { onUpsert: applyRemoteUpsert, onDelete: applyRemoteDelete })

  useEffect(() => {
    if (initialPageId) return
    try {
      const lastId = localStorage.getItem(lastPageKey(userId))
      const page = initialPages.find(p => p.id === lastId && !p.deleted_at)
      if (page) { setSelected(page); void ensureContent(page.id) }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const selectPageRight = useCallback((page: Page | null) => {
    setSelectedRight(page)
    setScrolledPastRight(false)
    if (page) void ensureContent(page.id)
    if (mainScrollRefRight.current) mainScrollRefRight.current.scrollTop = 0
  }, [ensureContent])

  const selectPage = useCallback((page: Page | null) => {
    setShowSettings(false)
    setShowTemplateModal(false)
    setShowQuickCapture(false)
    setShowTrash(false)
    setSelected(page)
    if (page) {
      void ensureContent(page.id)
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
  }, [pages, userId, ensureContent])

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

  // Keyboard shortcuts — bare keys (only when not typing in a field/editor).
  // Les handlers passent par une ref pour que l'écouteur ne soit abonné
  // qu'une seule fois (avant : réabonnement à chaque render, les fonctions
  // n'étant pas mémoïsées).
  const shortcutsRef = useRef({ confirmDeleteId, deletePage, addPage, addJournalEntry })
  useEffect(() => { shortcutsRef.current = { confirmDeleteId, deletePage, addPage, addJournalEntry } })
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
      const { confirmDeleteId, deletePage, addPage, addJournalEntry } = shortcutsRef.current
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
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  function toggleOpen(id: string) { setOpenMap(o => ({ ...o, [id]: !o[id] })) }

  async function addPage(parentId: string | null, template?: Template) {
    if (addingPageRef.current) return
    addingPageRef.current = true
    try {
      const icons = ['📄','📝','💡','🗂️','📌','🔖','⭐','🚀','🎯','💬']
      const icon = template?.icon || icons[Math.floor(Math.random() * icons.length)]
      const { data, error } = await createClient().from('pages')
        .insert({ title: template?.title || 'Sans titre', content: template?.content || '', user_id: userId, parent_id: parentId, position: pages.length, icon, type: 'page' })
        .select().single()
      if (error || !data) { toast('Impossible de créer la page — vérifiez votre connexion.', 'error'); return }
      markHydrated(data.id)
      setPages(prev => [...prev, data]); selectPage(data); setJustCreatedId(data.id); if (parentId) setOpenMap(o => ({ ...o, [parentId]: true }))
    } finally {
      addingPageRef.current = false
    }
  }

  async function addJournalEntry() {
    const mots = ['Réflexion', 'Fragment', 'Éclat', 'Lueur', 'Souffle', 'Trace', 'Murmure', 'Impression', 'Intuition', 'Instant', 'Étincelle', 'Écho', 'Envol', 'Vibration', 'Pensée', 'Grain', 'Sillon', 'Élancement']
    const title = mots[Math.floor(Math.random() * mots.length)]
    const { data, error } = await createClient().from('pages')
      .insert({ title, content: '', user_id: userId, parent_id: null, position: pages.length, icon: '📝', type: 'journal' })
      .select().single()
    if (error || !data) { toast('Impossible de créer l\'entrée — vérifiez votre connexion.', 'error'); return }
    markHydrated(data.id)
    setPages(prev => [...prev, data]); selectPage(data); setShowJournal(false)
  }

  async function convertToJournal(id: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, type: 'journal' as const, parent_id: null } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, type: 'journal' as const, parent_id: null } : null)
    await persist(createClient().from('pages').update({ type: 'journal', parent_id: null }).eq('id', id))
  }

  function syncSelectedPage(id: string, patch: Partial<Page>) {
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } : null)
    if (selectedRight?.id === id) setSelectedRight(prev => prev ? { ...prev, ...patch } : null)
  }

  // Écritures « fire-and-forget » : vérifie l'erreur Supabase et prévient
  // l'utilisateur au lieu d'échouer en silence (l'état local optimiste
  // resterait sinon désynchronisé de la base sans que personne ne le sache).
  async function persist(
    query: PromiseLike<{ error: unknown }>,
    message = 'Erreur de sauvegarde — vérifiez votre connexion.'
  ): Promise<boolean> {
    try {
      const { error } = await query
      if (error) throw error
      return true
    } catch {
      toast(message, 'error')
      return false
    }
  }

  function updateTitle(value: string, pageId: string) {
    const updated_at = new Date().toISOString()
    syncSelectedPage(pageId, { title: value, updated_at })
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, title: value, updated_at } : p))
    queueSave(pageId, { title: value })
  }

  async function updateIcon(id: string, icon: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, icon } : p))
    syncSelectedPage(id, { icon })
    await persist(createClient().from('pages').update({ icon }).eq('id', id))
  }

  async function updateTags(id: string, tags: string[]) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, tags } : p))
    syncSelectedPage(id, { tags })
    await persist(createClient().from('pages').update({ tags }).eq('id', id))
  }

  async function updateCreatedAt(id: string, iso: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, created_at: iso } : p))
    syncSelectedPage(id, { created_at: iso })
    await persist(createClient().from('pages').update({ created_at: iso }).eq('id', id))
  }

  async function renamePage(id: string, title: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, title } : p))
    syncSelectedPage(id, { title })
    await persist(createClient().from('pages').update({ title }).eq('id', id))
  }

  async function movePage(id: string, newParentId: string | null) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, parent_id: newParentId } : p))
    syncSelectedPage(id, { parent_id: newParentId })
    if (newParentId) setOpenMap(o => ({ ...o, [newParentId]: true }))
    if (await persist(createClient().from('pages').update({ parent_id: newParentId }).eq('id', id))) {
      toast('Page déplacée.', 'success')
    }
  }

  async function duplicatePage(id: string) {
    const page = pages.find(p => p.id === id)
    if (!page) return
    // Le contenu peut ne pas être encore hydraté : on le lit directement en
    // base pour ne pas dupliquer une note vide.
    let content = page.content
    if (!hydratedRef.current.has(id)) {
      const { data: row } = await createClient().from('pages').select('content').eq('id', id).single()
      content = row?.content ?? ''
    }
    const { data, error } = await createClient().from('pages')
      .insert({ title: (page.title || 'Sans titre') + ' (copie)', content, user_id: userId, parent_id: page.parent_id, position: page.position + 0.5, icon: page.icon, type: page.type })
      .select(PAGE_META_COLUMNS).single()
    if (error || !data) { toast('Erreur lors de la duplication.', 'error'); return }
    const created = { ...data, content } as Page
    markHydrated(created.id)
    setPages(prev => [...prev, created]); selectPage(created); setJustCreatedId(created.id)
  }

  function updateContent(content: string, pageId?: string) {
    const targetId = pageId ?? selected?.id
    if (!targetId) return
    const updated_at = new Date().toISOString()
    recordLocalContent(targetId, content) // pour reconnaître l'écho Realtime
    syncSelectedPage(targetId, { content, updated_at })
    setPages(prev => prev.map(p => p.id === targetId ? { ...p, content, updated_at } : p))
    queueSave(targetId, { content })
  }

  async function deletePage(id: string) {
    const deletedAt = new Date().toISOString()
    const wasJournal = selected?.id === id && selected?.type === 'journal'
    // Tout le sous-arbre part à la corbeille avec le même horodatage ; les
    // descendants déjà à la corbeille gardent le leur (supprimés séparément).
    const ids = [id, ...getDescendantIds(pages, id).filter(did => !pages.find(p => p.id === did)?.deleted_at)]
    const idSet = new Set(ids)
    ids.forEach(i => deletedTombstoneRef.current.add(i))
    setPages(prev => prev.map(p => idSet.has(p.id) ? { ...p, deleted_at: deletedAt } : p))
    if (selected && idSet.has(selected.id)) {
      if (wasJournal) {
        setSelected(null)
        setShowJournal(true)
      } else {
        setSelected(activePages.find(p => !idSet.has(p.id) && p.type !== 'journal') || null)
      }
    }
    if (selectedRight && idSet.has(selectedRight.id)) setSelectedRight(null)
    toast('Déplacé dans la corbeille.', 'info', { label: 'Annuler', onAction: () => restorePage(id) })
    await persist(createClient().from('pages').update({ deleted_at: deletedAt }).in('id', ids))
  }

  async function restorePage(id: string) {
    const page = pages.find(p => p.id === id)
    if (!page) return
    // Restaure la page et les descendants supprimés dans le même lot (même
    // horodatage) — ceux mis à la corbeille séparément y restent.
    const ids = [id, ...getDescendantIds(pages, id).filter(did =>
      pages.find(p => p.id === did)?.deleted_at === page.deleted_at
    )]
    const idSet = new Set(ids)
    // La page redevient active : on lève le tombstone pour de nouveau accepter
    // ses événements Realtime.
    ids.forEach(i => deletedTombstoneRef.current.delete(i))
    // Si le parent est toujours à la corbeille, la page restaurée serait
    // invisible dans l'arborescence : on la rattache à la racine.
    const parentStillTrashed = !!(page.parent_id && pages.find(p => p.id === page.parent_id)?.deleted_at)
    setPages(prev => prev.map(p => {
      if (!idSet.has(p.id)) return p
      const restored = { ...p, deleted_at: null }
      if (p.id === id && parentStillTrashed) restored.parent_id = null
      return restored
    }))
    const ok = await persist(createClient().from('pages').update({ deleted_at: null }).in('id', ids))
    if (ok && parentStillTrashed) await persist(createClient().from('pages').update({ parent_id: null }).eq('id', id))
    if (ok) toast('Note restaurée.', 'success')
  }

  async function deleteForever(id: string) {
    // Supprime tout le sous-arbre, sinon les descendants resteraient en base
    // comme lignes orphelines invisibles.
    const ids = new Set([id, ...getDescendantIds(pages, id)])
    const deleted = pages.filter(p => ids.has(p.id))
    const surviving = pages.filter(p => !ids.has(p.id))
    ids.forEach(i => deletedTombstoneRef.current.add(i))
    setPages(prev => prev.filter(p => !ids.has(p.id)))
    if (await persist(createClient().from('pages').delete().in('id', Array.from(ids)), 'Erreur lors de la suppression définitive.')) {
      toast('Supprimée définitivement.', 'info')
      // Nettoyage best-effort des objets Storage désormais orphelins.
      void cleanupOrphanStorage(deleted, surviving)
    }
  }

  // Supprime du Storage les images / couvertures uploadées des pages
  // définitivement supprimées, sauf si un autre page survivante les référence
  // encore (les doublons partagent les mêmes URLs). Best-effort : toute erreur
  // (droits Storage manquants, réseau) laisse simplement l'objet en place.
  async function cleanupOrphanStorage(deleted: Page[], surviving: Page[]) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (!supabaseUrl) return
    // Sécurité : ne rien supprimer si le contenu d'une page survivante n'est
    // pas encore hydraté — on risquerait d'effacer une image encore utilisée.
    if (!surviving.every(p => hydratedRef.current.has(p.id))) return

    // Contenu des pages supprimées (peut ne pas être hydraté à ce moment).
    let deletedFull = deleted
    const missing = deleted.filter(p => !hydratedRef.current.has(p.id))
    if (missing.length) {
      const { data } = await createClient().from('pages').select('id, content').in('id', missing.map(p => p.id))
      const byId = new Map((data || []).map(r => [r.id as string, (r.content ?? '') as string]))
      deletedFull = deleted.map(p => byId.has(p.id) ? { ...p, content: byId.get(p.id)! } : p)
    }

    const collect = (list: Page[], bucket: 'images' | 'covers') => {
      const set = new Set<string>()
      for (const p of list) {
        extractStoragePaths(p.content || '', bucket, supabaseUrl).forEach(x => set.add(x))
        if (p.cover_url) extractStoragePaths(p.cover_url, bucket, supabaseUrl).forEach(x => set.add(x))
      }
      return set
    }
    const delImages = collect(deletedFull, 'images')
    const delCovers = collect(deletedFull, 'covers')
    if (delImages.size === 0 && delCovers.size === 0) return

    const survImages = collect(surviving, 'images')
    const survCovers = collect(surviving, 'covers')
    const imagesToRemove = [...delImages].filter(x => !survImages.has(x))
    const coversToRemove = [...delCovers].filter(x => !survCovers.has(x))

    if (imagesToRemove.length) {
      const { error } = await createClient().storage.from('images').remove(imagesToRemove)
      if (error) console.error('Nettoyage images orphelines:', error.message)
    }
    if (coversToRemove.length) {
      const { error } = await createClient().storage.from('covers').remove(coversToRemove)
      if (error) console.error('Nettoyage couvertures orphelines:', error.message)
    }
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
      markHydrated(data.id) // l'upsert renvoie le content complet
      deletedTombstoneRef.current.delete(data.id) // ré-import éventuel d'un id supprimé
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
    const results = await Promise.all(updates.map(u => createClient().from('pages').update({ position: u.position, parent_id: u.parent_id }).eq('id', u.id)))
    if (results.some(r => r.error)) toast('Erreur lors du réordonnancement — vérifiez votre connexion.', 'error')
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
              const results = await Promise.all(updates.map(u => createClient().from('pages').update({ favorite_position: u.favorite_position }).eq('id', u.id)))
              if (results.some(r => r.error)) toast('Erreur lors du réordonnancement des favoris.', 'error')
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
            onShowSettings={() => setShowSettings(true)}
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
              {scrolledPast && (
                <>
                  <style>{`@keyframes _shi{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
                  <div className="sticky top-0 z-20 flex items-center gap-1 px-2"
                    style={{ height: isMobile ? 'calc(44px + env(safe-area-inset-top, 0px))' : '44px', paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : undefined, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', animation: '_shi 180ms ease both' }}>
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
                  saveState={saveState}
                />
                <PageHeader
                  page={selected}
                  pages={[...activePages, ...journalEntries]}
                  userId={userId}
                  saveState={saveState}
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
                {hydratedIds.has(selected.id) ? (
                  <Editor
                    key={`${selected.id}:${editorNonce}`}
                    page={selected}
                    pages={[...activePages, ...journalEntries]}
                    onUpdate={content => updateContent(content, selected.id)}
                    onAddSubpage={() => addPage(selected.id)}
                    onNavigate={p => { selectPage(p); if (p.type === 'journal') setShowJournal(false) }}
                    userId={userId}
                    isMobile={isMobile}
                    focusMode={sidebarHidden}
                  />
                ) : (
                  <ContentLoading isMobile={isMobile} />
                )}
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
                    saveState={saveState}
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
                  {hydratedIds.has(selectedRight.id) ? (
                    <Editor
                      key={`right-${selectedRight.id}:${editorNonce}`}
                      page={selectedRight}
                      pages={[...activePages, ...journalEntries]}
                      onUpdate={content => updateContent(content, selectedRight.id)}
                      onAddSubpage={() => addPage(selectedRight.id)}
                      onNavigate={p => selectPageRight(p)}
                      userId={userId}
                      isMobile={false}
                      focusMode={false}
                    />
                  ) : (
                    <ContentLoading isMobile={false} />
                  )}
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
