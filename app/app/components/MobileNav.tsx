'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Page, SaveState } from '../types'
import { SaveIndicator } from './SaveIndicator'
import { tiptapToText, getSnippet, matchesQuery, Highlighted } from '../search'

const MOBILE_JOURNAL_PAGE = 30

// Swipe vers le bas pour fermer un écran mobile « du dessus » (modale bottom
// sheet, vue poussée, ou note/entrée de journal ouverte). `sheetRef` va sur
// tout le panneau (pas juste l'en-tête — sinon le geste ne « prend » que si
// on vise précisément cette petite zone) ; `contentRef` pointe vers la zone
// qui défile (peut être le même nœud que sheetRef s'il n'y a pas de zone
// d'en-tête séparée, ex. une note). Le geste n'est armé que si le défilement
// est déjà tout en haut (scrollTop <= 0) — comme le tirer-pour-actualiser —
// pour ne jamais entrer en conflit avec le scroll normal du contenu.
// `style` va sur le conteneur qui doit visuellement suivre le doigt (le
// panneau/la vue elle-même, pas l'arrière-plan/backdrop).
//
// Écouteur natif non passif (plutôt que onTouchMove React, passif par
// défaut) : sans preventDefault sur le touchmove, iOS Safari fait rebondir
// la page entière derrière le panneau pendant le drag.
export function useSwipeDownToDismiss(onClose: () => void, contentRef?: React.RefObject<HTMLElement | null>) {
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const dirRef = useRef<'horizontal' | 'vertical' | null>(null)
  const armedRef = useRef(false)
  const dragYRef = useRef(0)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const THRESHOLD = 80

  useEffect(() => {
    const el = sheetRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      startRef.current = { x: t.clientX, y: t.clientY }
      dirRef.current = null
      const content = contentRef?.current
      const insideContent = !!content && content.contains(e.target as Node)
      armedRef.current = !insideContent || content!.scrollTop <= 0
    }
    function onTouchMove(e: TouchEvent) {
      if (!startRef.current) return
      const t = e.touches[0]
      const dx = t.clientX - startRef.current.x
      const dy = t.clientY - startRef.current.y
      if (dirRef.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        dirRef.current = Math.abs(dy) > Math.abs(dx) * 1.2 ? 'vertical' : 'horizontal'
        if (dirRef.current === 'vertical' && armedRef.current) setDragging(true)
      }
      if (dirRef.current === 'vertical' && armedRef.current && dy > 0) {
        e.preventDefault()
        const next = Math.min(dy, 220)
        dragYRef.current = next
        setDragY(next)
      }
    }
    function onTouchEnd() {
      const shouldClose = dirRef.current === 'vertical' && armedRef.current && dragYRef.current >= THRESHOLD
      startRef.current = null
      dirRef.current = null
      armedRef.current = false
      dragYRef.current = 0
      setDragging(false)
      setDragY(0)
      if (shouldClose) onCloseRef.current()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [contentRef])

  return {
    sheetRef,
    style: { transform: `translateY(${dragY}px)`, transition: dragging ? 'none' : 'transform 200ms ease' },
  }
}

function MobileSearchOverlay({ pages, onSelect, onClose }: {
  pages: Page[]
  onSelect: (p: Page) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Double tentative : immédiat + délai pour iOS qui ignore le premier focus
    inputRef.current?.focus()
    const t1 = setTimeout(() => inputRef.current?.focus(), 50)
    const t2 = setTimeout(() => inputRef.current?.focus(), 200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const pageTexts = useMemo(
    () => pages.map(function(p) { return { page: p, text: tiptapToText(p.content) } }),
    [pages]
  )

  const results = useMemo(function() {
    if (query.length < 2) return []
    return pageTexts
      .filter(function({ page, text }) {
        return matchesQuery(page.title || '', text, query)
      })
      .map(function({ page, text }) {
        return { page: page, snippet: getSnippet(text, query, 35, 70) }
      })
      .slice(0, 20)
  }, [query, pageTexts])

  var noteResults = results.filter(function(r) { return r.page.type !== 'journal' })
  var journalResults = results.filter(function(r) { return r.page.type === 'journal' })

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <style>{`.search-highlight{background:var(--search-highlight,#fde68a);color:inherit;border-radius:2px;padding:0 1px}`}</style>
      <div className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--selected-bg)' }}>
          <i className="ti ti-search" style={{ fontSize: '15px', color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher dans toutes les pages…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="w-5 h-5 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
          )}
        </div>
        <button onClick={onClose} className="flex-shrink-0 text-sm font-medium px-1" style={{ color: 'var(--text-secondary)' }}>
          Annuler
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">🔍</span>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tape pour chercher dans tes pages</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">🌫️</span>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun résultat pour « {query} »</p>
          </div>
        ) : (
          <div className="px-3 py-2">
            {noteResults.length > 0 && (
              <>
                <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Pages · {noteResults.length}
                </p>
                {noteResults.map(function({ page, snippet }) {
                  return (
                    <SearchResultRow key={page.id} page={page} snippet={snippet} query={query}
                      onSelect={() => { onSelect(page); onClose() }} />
                  )
                })}
              </>
            )}
            {journalResults.length > 0 && (
              <>
                <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Journal · {journalResults.length}
                </p>
                {journalResults.map(function({ page, snippet }) {
                  return (
                    <SearchResultRow key={page.id} page={page} snippet={snippet} query={query}
                      onSelect={() => { onSelect(page); onClose() }} />
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SearchResultRow({ page, snippet, query, onSelect }: {
  page: Page
  snippet: string | null
  query: string
  onSelect: () => void
}) {
  return (
    <div onClick={onSelect}
      className="flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer active:opacity-70"
      style={{ borderBottom: '1px solid var(--border-light)' }}>
      <span className="text-xl flex-shrink-0 mt-0.5">{page.icon || '📄'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          <Highlighted text={page.title || 'Sans titre'} query={query} />
        </p>
        {snippet && (
          <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
            <Highlighted text={snippet} query={query} />
          </p>
        )}
      </div>
    </div>
  )
}

// Ligne « swipeable » : swipe gauche = action destructive (rouge, ex.
// corbeille), swipe droite = action secondaire (accent, ex. favori). Le
// contenu réel de la ligne reste inchangé (children) ; ce wrapper ajoute
// juste le drag horizontal + les pastilles de fond révélées dessous.
function SwipeableRow({ children, onSwipeLeft, onSwipeRight, leftIcon = '🗑', rightIcon = '★', onLongPress, selectMode }: {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  leftIcon?: string
  rightIcon?: string
  onLongPress?: () => void
  selectMode?: boolean
}) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const dirRef = useRef<'horizontal' | 'vertical' | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const THRESHOLD = 72
  const MAX = 96
  const LONG_PRESS_MS = 500

  function clearLongPressTimer() {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    startRef.current = { x: t.clientX, y: t.clientY }
    dirRef.current = null
    longPressFiredRef.current = false
    if (onLongPress && !selectMode) {
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true
        longPressTimerRef.current = null
        onLongPress()
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
      }, LONG_PRESS_MS)
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!startRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - startRef.current.x
    const dy = t.clientY - startRef.current.y
    if (dirRef.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      dirRef.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'horizontal' : 'vertical'
      if (dirRef.current === 'horizontal') setDragging(true)
      clearLongPressTimer()
    }
    if (dirRef.current === 'horizontal') {
      // Empêche le geste de remonter jusqu'au conteneur (qui gère le swipe
      // Pages ↔ Journal) une fois qu'on a engagé un drag horizontal ici.
      e.stopPropagation()
      let next = dx
      if (next < 0 && !onSwipeLeft) next = 0
      if (next > 0 && !onSwipeRight) next = 0
      setDragX(Math.max(-MAX, Math.min(MAX, next)))
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    clearLongPressTimer()
    if (dirRef.current === 'horizontal') {
      e.stopPropagation()
      if (dragX <= -THRESHOLD && onSwipeLeft) onSwipeLeft()
      else if (dragX >= THRESHOLD && onSwipeRight) onSwipeRight()
    }
    if (longPressFiredRef.current) {
      // Avale le clic fantôme qui suivrait l'appui long, pour ne pas
      // déclencher la sélection/navigation normale en plus.
      e.preventDefault()
      longPressFiredRef.current = false
    }
    startRef.current = null
    dirRef.current = null
    setDragging(false)
    setDragX(0)
  }

  if (selectMode) return <>{children}</>
  if (!onSwipeLeft && !onSwipeRight && !onLongPress) return <>{children}</>

  return (
    <div className="relative overflow-hidden rounded-xl">
      {onSwipeLeft && (
        <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 rounded-xl"
          style={{ width: MAX + 24, background: '#ef4444', opacity: Math.min(1, Math.max(0, -dragX) / THRESHOLD) }}>
          <span className="text-white text-base">{leftIcon}</span>
        </div>
      )}
      {onSwipeRight && (
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 rounded-xl"
          style={{ width: MAX + 24, background: 'var(--accent)', opacity: Math.min(1, Math.max(0, dragX) / THRESHOLD) }}>
          <span className="text-white text-base">{rightIcon}</span>
        </div>
      )}
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 200ms ease',
          background: 'var(--app-bg)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function SelectCheckbox({ checked }: { checked?: boolean }) {
  return (
    <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
      style={{ borderColor: checked ? 'var(--accent)' : 'var(--text-faint)', background: checked ? 'var(--accent)' : 'transparent' }}>
      {checked && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
    </span>
  )
}

function JournalRow({ entry, selectedId, onSelect, onToggleFavorite, selectMode, checked }: {
  entry: Page, selectedId: string | null,
  onSelect: (p: Page) => void, onToggleFavorite: (id: string) => void,
  selectMode?: boolean, checked?: boolean,
}) {
  return (
    <div
      onClick={() => onSelect(entry)}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors mobile-row-hover ${selectedId === entry.id ? 'mobile-row-selected' : ''}`}
    >
      {selectMode && <SelectCheckbox checked={checked} />}
      <span className="text-xl flex-shrink-0">{entry.icon || '📝'}</span>
      <div className="flex-1 min-w-0">
        <span className="block text-sm truncate" style={{ color: 'var(--text-primary)' }}>{entry.title || 'Sans titre'}</span>
        {(entry.tags || []).length > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
            {(entry.tags || []).slice(0, 2).map(function(tag) {
              return (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                  {tag}
                </span>
              )
            })}
            {(entry.tags || []).length > 2 && (
              <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>+{(entry.tags || []).length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function MobileHomeView({ pages, selectedId, onSelect, onAdd, onShowTrash, trashedCount, onToggleFavorite, onShowJournal, journalCount, onAddJournalEntry, onShowSettings, onShowTags, onShowReview, onShowRecent, onMoveTo, onDuplicate, onDeleteRequest, onRefresh, onDeleteMany }: {
  pages: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onAdd: (parentId: string | null) => void
  onShowTrash: () => void
  trashedCount: number
  onToggleFavorite: (id: string) => void
  onShowJournal: () => void
  journalCount: number
  onAddJournalEntry: () => void
  onShowSettings: () => void
  onShowTags: () => void
  onShowReview: () => void
  onShowRecent: () => void
  onMoveTo: (id: string) => void
  onDuplicate: (id: string) => void
  onDeleteRequest: (id: string) => void
  onRefresh?: () => void | Promise<void>
  onDeleteMany?: (ids: string[]) => void
}) {
  const [showSearch, setShowSearch] = useState(false)
  const [tab, setTab] = useState<'pages' | 'journal'>('pages')
  // Direction de l'effet de transition du contenu au changement d'onglet.
  const [tabAnim, setTabAnim] = useState<'from-right' | 'from-left'>('from-right')
  function switchTab(next: 'pages' | 'journal') {
    if (next === tab) return
    setTabAnim(next === 'journal' ? 'from-right' : 'from-left')
    setTab(next)
  }
  const [journalLimit, setJournalLimit] = useState(MOBILE_JOURNAL_PAGE)
  const journalSentinelRef = useRef<HTMLDivElement>(null)
  // drill-down stack : chaque entrée = { id, title, icon } de la page parente
  const [drillStack, setDrillStack] = useState<{ id: string; title: string; icon: string }[]>([])
  const [actionSheetPage, setActionSheetPage] = useState<Page | null>(null)

  // Sélection multiple (appui long sur une ligne pour l'activer).
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  function enterSelectMode(id: string) {
    setSelectMode(true)
    setSelectedIds(new Set([id]))
  }
  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }
  // Changer d'onglet (Pages/Journal) quitte la sélection en cours, pour ne
  // pas mélanger des ids des deux listes.
  useEffect(() => { exitSelectMode() }, [tab])

  // Tirer pour actualiser (contenu de la liste) : n'est armé que si le
  // geste démarre scrollTop === 0.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipeDirRef = useRef<'horizontal' | 'vertical' | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pullActiveRef = useRef(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const PULL_THRESHOLD = 56
  function onContentTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    swipeDirRef.current = null
    pullActiveRef.current = !isRefreshing && !selectMode && (scrollRef.current?.scrollTop ?? 0) <= 0
  }
  function onContentTouchMove(e: React.TouchEvent) {
    if (!touchStartRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    if (swipeDirRef.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      swipeDirRef.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'horizontal' : 'vertical'
    }
    if (pullActiveRef.current && swipeDirRef.current === 'vertical' && dy > 0 && drillStack.length === 0) {
      setPullDistance(Math.min(dy * 0.5, 72))
    } else if (pullDistance !== 0) {
      setPullDistance(0)
    }
  }
  function onContentTouchEnd() {
    const wasPulling = pullActiveRef.current
    touchStartRef.current = null
    swipeDirRef.current = null
    pullActiveRef.current = false
    if (wasPulling && pullDistance >= PULL_THRESHOLD && onRefresh) {
      setIsRefreshing(true)
      setPullDistance(PULL_THRESHOLD)
      Promise.resolve(onRefresh()).finally(() => { setIsRefreshing(false); setPullDistance(0) })
    } else {
      setPullDistance(0)
    }
  }

  // Swipe horizontal Pages ↔ Journal, ancré sur l'en-tête (icône + titre +
  // onglets) plutôt que sur le contenu : les lignes gèrent déjà leur propre
  // swipe (suppression/favori) et interceptent le geste avant qu'il
  // n'atteigne le conteneur, ce qui rendait le swipe de bascule peu fiable
  // dès que le doigt démarrait sur une ligne. Uniquement au premier niveau,
  // hors drill-down dans un dossier, pour ne pas interférer avec cette
  // navigation.
  const headerTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const headerDirRef = useRef<'horizontal' | 'vertical' | null>(null)
  function onHeaderTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    headerTouchStartRef.current = { x: t.clientX, y: t.clientY }
    headerDirRef.current = null
  }
  function onHeaderTouchMove(e: React.TouchEvent) {
    if (!headerTouchStartRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - headerTouchStartRef.current.x
    const dy = t.clientY - headerTouchStartRef.current.y
    if (headerDirRef.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      headerDirRef.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'horizontal' : 'vertical'
    }
  }
  function onHeaderTouchEnd(e: React.TouchEvent) {
    const start = headerTouchStartRef.current
    const dir = headerDirRef.current
    headerTouchStartRef.current = null
    headerDirRef.current = null
    if (!start || dir !== 'horizontal' || drillStack.length > 0) return
    const dx = e.changedTouches[0].clientX - start.x
    if (Math.abs(dx) < 50) return
    if (dx < 0 && tab === 'pages') switchTab('journal')
    else if (dx > 0 && tab === 'journal') switchTab('pages')
  }

  const nonJournalPages = pages.filter(function(p) { return p.type !== 'journal' && !p.deleted_at })
  const journalEntries = pages.filter(function(p) { return p.type === 'journal' && !p.deleted_at })
  const favorites = nonJournalPages.filter(function(p) { return p.favorite }).sort(function(a, b) { return (a.favorite_position ?? 999) - (b.favorite_position ?? 999) })

  const recentPages = [...nonJournalPages]
    .sort(function(a, b) { return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() })
    .slice(0, 6)
    .filter(function(p) { return !p.favorite })

  const currentParentId = drillStack.length > 0 ? drillStack[drillStack.length - 1].id : null
  const sortedPages = nonJournalPages
    .filter(function(p) { return p.parent_id === currentParentId })
    .sort(function(a, b) { return a.position - b.position })
  const sortedJournal = [...journalEntries].sort(function(a, b) {
    return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
  })
  const visibleJournal = sortedJournal.slice(0, journalLimit)
  const journalHasMore = sortedJournal.length > journalLimit

  useEffect(() => {
    if (!journalSentinelRef.current || !journalHasMore) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setJournalLimit(function(l) { return l + MOBILE_JOURNAL_PAGE })
    }, { threshold: 0.1 })
    obs.observe(journalSentinelRef.current)
    return () => obs.disconnect()
  }, [journalHasMore])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--app-bg)' }}>
      <style>{`
        @keyframes _tabInRight { from { opacity: 0; transform: translateX(18px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes _tabInLeft { from { opacity: 0; transform: translateX(-18px) } to { opacity: 1; transform: translateX(0) } }
      `}</style>
      {showSearch && (
        <MobileSearchOverlay
          pages={pages}
          onSelect={function(p) { onSelect(p) }}
          onClose={() => setShowSearch(false)}
        />
      )}

      <div className="flex items-center justify-between px-4 pb-2 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}>
        <div className="flex items-center gap-2">
          <img src="/apple-touch-icon.png" alt="Idée" className="w-7 h-7 rounded-xl flex-shrink-0" />
          <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Idée</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onShowTags}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ color: 'var(--text-muted)' }}
            title="Tags"
          >🏷️</button>
          <button
            onClick={onShowReview}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ color: 'var(--text-muted)' }}
            title="Mode révision"
          >🎲</button>
          <button
            onClick={onShowRecent}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ color: 'var(--text-muted)' }}
            title="Vue récente"
          >🕐</button>
          <button
            onClick={onShowTrash}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ color: 'var(--text-muted)' }}
          >
            🗑
            {trashedCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-400 text-white text-[9px] rounded-full flex items-center justify-center">
                {trashedCount}
              </span>
            )}
          </button>
          <button
            onClick={onShowSettings}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ color: 'var(--text-muted)' }}
          >⚙️</button>
        </div>
      </div>

      <div className="flex px-3 gap-1 pb-2 flex-shrink-0"
        onTouchStart={onHeaderTouchStart} onTouchMove={onHeaderTouchMove} onTouchEnd={onHeaderTouchEnd}>
        <button
          onClick={() => { switchTab('pages'); setDrillStack([]) }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: tab === 'pages' ? 'var(--selected-bg)' : 'transparent', color: tab === 'pages' ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          <span>📄</span><span>Pages</span>
        </button>
        <button
          onClick={() => switchTab('journal')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: tab === 'journal' ? 'var(--selected-bg)' : 'transparent', color: tab === 'journal' ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          <span>📓</span><span>Journal</span>
          {journalCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
              {journalCount}
            </span>
          )}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-2" style={{ overscrollBehaviorY: 'contain' }}
        onTouchStart={onContentTouchStart} onTouchMove={onContentTouchMove} onTouchEnd={onContentTouchEnd}>
        {(pullDistance > 0 || isRefreshing) && (
          <div className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
            style={{ height: isRefreshing ? PULL_THRESHOLD : pullDistance, color: 'var(--text-muted)', fontSize: 12 }}>
            <span style={{ transform: !isRefreshing && pullDistance >= PULL_THRESHOLD ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', display: 'inline-block', marginRight: 6 }}>
              {isRefreshing ? '↻' : '↓'}
            </span>
            {isRefreshing ? 'Actualisation…' : pullDistance >= PULL_THRESHOLD ? 'Relâcher pour actualiser' : 'Tirer pour actualiser'}
          </div>
        )}
        <div key={tab} style={{ animation: `${tabAnim === 'from-right' ? '_tabInRight' : '_tabInLeft'} 220ms cubic-bezier(0.22,1,0.36,1) both` }}>
        {tab === 'pages' ? (
          <>
            {favorites.length > 0 && (
              <>
                <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Favoris</p>
                {favorites.map(function(page) {
                  return (
                    <SwipeableRow key={page.id} onSwipeLeft={() => onDeleteRequest(page.id)} onSwipeRight={() => onToggleFavorite(page.id)}
                      onLongPress={onDeleteMany ? () => enterSelectMode(page.id) : undefined} selectMode={selectMode}>
                      <PageRow page={page} selectedId={selectedId}
                        onSelect={selectMode ? () => toggleSelected(page.id) : onSelect}
                        onToggleFavorite={onToggleFavorite}
                        onShowActions={selectMode ? undefined : setActionSheetPage}
                        selectMode={selectMode} checked={selectedIds.has(page.id)} />
                    </SwipeableRow>
                  )
                })}
                <div className="mx-2 my-2" style={{ borderTop: '1px solid var(--border-light)' }} />
              </>
            )}
            {recentPages.length > 0 && (
              <>
                <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Récents</p>
                {recentPages.map(function(page) {
                  return (
                    <SwipeableRow key={page.id} onSwipeLeft={() => onDeleteRequest(page.id)} onSwipeRight={() => onToggleFavorite(page.id)}
                      onLongPress={onDeleteMany ? () => enterSelectMode(page.id) : undefined} selectMode={selectMode}>
                      <PageRow page={page} selectedId={selectedId}
                        onSelect={selectMode ? () => toggleSelected(page.id) : onSelect}
                        onToggleFavorite={onToggleFavorite}
                        onShowActions={selectMode ? undefined : setActionSheetPage}
                        selectMode={selectMode} checked={selectedIds.has(page.id)} />
                    </SwipeableRow>
                  )
                })}
                <div className="mx-2 my-2" style={{ borderTop: '1px solid var(--border-light)' }} />
              </>
            )}
            {/* Breadcrumb drill-down */}
            {drillStack.length > 0 ? (
              <div className="flex items-center gap-1 px-2 pt-1 pb-1 flex-wrap">
                <button
                  onClick={() => setDrillStack([])}
                  className="text-[11px] flex-shrink-0 py-0.5 px-1 rounded"
                  style={{ color: 'var(--accent)' }}
                >Pages</button>
                {drillStack.map(function(crumb, i) {
                  return (
                    <span key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
                      <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>/</span>
                      <button
                        onClick={() => setDrillStack(function(s) { return s.slice(0, i + 1) })}
                        className="text-[11px] py-0.5 px-1 rounded truncate max-w-[120px]"
                        style={{ color: i === drillStack.length - 1 ? 'var(--text-primary)' : 'var(--accent)' }}
                      >{crumb.icon} {crumb.title || 'Sans titre'}</button>
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pages</p>
            )}
            {sortedPages.length === 0 && (
              <p className="text-sm px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Aucune page</p>
            )}
            {sortedPages.map(function(page) {
              const hasChildren = nonJournalPages.some(function(p) { return p.parent_id === page.id })
              return (
                <SwipeableRow key={page.id} onSwipeLeft={() => onDeleteRequest(page.id)} onSwipeRight={hasChildren ? undefined : () => onToggleFavorite(page.id)}
                  onLongPress={onDeleteMany ? () => enterSelectMode(page.id) : undefined} selectMode={selectMode}>
                  <PageRow page={page} selectedId={selectedId}
                    onSelect={selectMode ? () => toggleSelected(page.id) : onSelect}
                    onToggleFavorite={onToggleFavorite}
                    hasChildren={hasChildren}
                    onDrillDown={selectMode ? undefined : function(p) { setDrillStack(function(s) { return [...s, { id: p.id, title: p.title || 'Sans titre', icon: p.icon || '📄' }] }) }}
                    onShowActions={selectMode ? undefined : setActionSheetPage}
                    selectMode={selectMode} checked={selectedIds.has(page.id)}
                  />
                </SwipeableRow>
              )
            })}
          </>
        ) : (
          <>
            {sortedJournal.length === 0 && (
              <p className="text-sm px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Aucune entrée. Crée la première !</p>
            )}
            {sortedJournal.length > 0 && (
              <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {sortedJournal.length} entrée{sortedJournal.length > 1 ? 's' : ''}
              </p>
            )}
            {visibleJournal.map(function(entry) {
              return (
                <SwipeableRow key={entry.id} onSwipeLeft={() => onDeleteRequest(entry.id)}
                  onLongPress={onDeleteMany ? () => enterSelectMode(entry.id) : undefined} selectMode={selectMode}>
                  <JournalRow entry={entry} selectedId={selectedId}
                    onSelect={selectMode ? () => toggleSelected(entry.id) : onSelect}
                    onToggleFavorite={onToggleFavorite}
                    selectMode={selectMode} checked={selectedIds.has(entry.id)} />
                </SwipeableRow>
              )
            })}
            {journalHasMore && <div ref={journalSentinelRef} className="h-8" />}
          </>
        )}
        </div>
      </div>

      {/* Bottom nav — deux actions, remplacée par la barre de sélection multiple */}
      {selectMode ? (
        <div
          className="flex-shrink-0 flex items-stretch gap-2 px-3 pt-2"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
            borderTop: '1px solid var(--border)',
            background: 'var(--app-bg)',
          }}
        >
          <button
            onClick={exitSelectMode}
            className="flex items-center justify-center px-4 py-3 rounded-2xl text-sm font-medium transition-colors flex-shrink-0"
            style={{ background: 'var(--selected-bg)', color: 'var(--text-secondary)' }}
          >
            Annuler
          </button>
          <span className="flex-1 flex items-center justify-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => { if (onDeleteMany && selectedIds.size > 0) onDeleteMany([...selectedIds]); exitSelectMode() }}
            disabled={selectedIds.size === 0}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-medium transition-colors flex-shrink-0"
            style={{ background: selectedIds.size > 0 ? '#ef4444' : 'var(--selected-bg)', color: selectedIds.size > 0 ? '#fff' : 'var(--text-faint)' }}
          >
            <span>🗑</span>
            <span>Supprimer</span>
          </button>
        </div>
      ) : (
        <div
          className="flex-shrink-0 flex items-stretch gap-2 px-3 pt-2"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
            borderTop: '1px solid var(--border)',
            background: 'var(--app-bg)',
          }}
        >
          <button
            onClick={() => tab === 'journal' ? onAddJournalEntry() : onAdd(currentParentId)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-colors"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
          >
            <i className={`ti ${tab === 'journal' ? 'ti-pencil' : 'ti-plus'}`} style={{ fontSize: '15px' }} />
            <span>{tab === 'journal' ? 'Nouvelle entrée' : drillStack.length > 0 ? 'Nouvelle sous-page' : 'Nouvelle page'}</span>
          </button>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-sm font-medium transition-colors flex-shrink-0"
            style={{ background: 'var(--selected-bg)', color: 'var(--text-secondary)' }}
          >
            <i className="ti ti-search" style={{ fontSize: '15px' }} />
            <span>Rechercher</span>
          </button>
        </div>
      )}

      {actionSheetPage && (
        <MobilePageActionSheet
          page={actionSheetPage}
          onClose={() => setActionSheetPage(null)}
          onAddSubpage={() => onAdd(actionSheetPage.id)}
          onMoveTo={() => onMoveTo(actionSheetPage.id)}
          onDuplicate={() => onDuplicate(actionSheetPage.id)}
          onDelete={() => onDeleteRequest(actionSheetPage.id)}
        />
      )}
    </div>
  )
}

function PageRow({ page, selectedId, onSelect, onToggleFavorite, onDrillDown, hasChildren, onShowActions, selectMode, checked }: {
  page: Page, selectedId: string | null,
  onSelect: (p: Page) => void,
  onToggleFavorite: (id: string) => void,
  hasChildren?: boolean,
  onDrillDown?: (p: Page) => void,
  onShowActions?: (p: Page) => void,
  selectMode?: boolean, checked?: boolean,
}) {
  return (
    <div
      onClick={() => hasChildren && onDrillDown ? onDrillDown(page) : onSelect(page)}
      className={`flex items-center gap-2 px-3 py-3 rounded-xl cursor-pointer transition-colors mobile-row-hover ${selectedId === page.id ? 'mobile-row-selected' : ''}`}
    >
      {selectMode && <SelectCheckbox checked={checked} />}
      <span className="text-xl flex-shrink-0">{page.icon || '📄'}</span>
      <span className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{page.title || 'Sans titre'}</span>
      {!selectMode && !hasChildren && (
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite(page.id) }}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
          style={{ color: page.favorite ? 'var(--accent)' : 'var(--text-faint)' }}
        >
          {page.favorite ? '★' : '☆'}
        </button>
      )}
      {!selectMode && onShowActions && (
        <button
          onClick={e => { e.stopPropagation(); onShowActions(page) }}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-base transition-colors"
          style={{ color: 'var(--text-faint)' }}
          title="Plus d'actions"
        >⋯</button>
      )}
      {!selectMode && hasChildren && (
        <>
          <button
            onClick={e => { e.stopPropagation(); onSelect(page) }}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors"
            style={{ color: 'var(--text-faint)' }}
            title="Ouvrir"
          >↗</button>
          <span className="flex-shrink-0 text-sm" style={{ color: 'var(--text-faint)' }}>›</span>
        </>
      )}
    </div>
  )
}

function MobilePageActionSheet({ page, onClose, onAddSubpage, onMoveTo, onDuplicate, onDelete }: {
  page: Page
  onClose: () => void
  onAddSubpage: () => void
  onMoveTo: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  function Item({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
    return (
      <button onClick={() => { onClick(); onClose() }}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-left active:opacity-60"
        style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}>
        <i className={`ti ti-${icon} flex-shrink-0`} style={{ fontSize: '17px', width: '20px', textAlign: 'center' }} />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <div className="fixed inset-0 z-[400] flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full rounded-t-2xl overflow-hidden" style={{ background: 'var(--card-bg)' }} onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: 'var(--border)' }} />
        <div className="px-4 py-3 flex items-center gap-2 text-sm font-medium" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <span className="flex-shrink-0">{page.icon || '📄'}</span>
          <span className="truncate">{page.title || 'Sans titre'}</span>
        </div>
        <div className="py-1">
          <Item icon="file-plus" label="Ajouter une sous-page" onClick={onAddSubpage} />
          <Item icon="folder-symlink" label="Déplacer vers…" onClick={onMoveTo} />
          <Item icon="copy" label="Dupliquer" onClick={onDuplicate} />
        </div>
        <div style={{ height: '1px', background: 'var(--border)' }} />
        <div className="py-1">
          <Item icon="trash" label="Mettre à la corbeille" onClick={onDelete} danger />
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}

export function MobileTopBar({ onBack, backLabel = 'Pages', saveState }: {
  onBack: () => void
  backLabel?: string
  saveState: SaveState
}) {
  return (
    <div className="md:hidden flex items-center gap-2 px-3 pb-1 flex-shrink-0"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
      <button
        onClick={onBack}
        className="flex items-center gap-1 py-2 px-2 rounded-xl active:opacity-60 transition-opacity"
        style={{ color: 'var(--accent)', minWidth: 44, minHeight: 44 }}
      >
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none" style={{ flexShrink: 0 }}>
          <path d="M8 1L1.5 7.5L8 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-sm font-medium ml-0.5">{backLabel}</span>
      </button>
      <div className="flex-1" />
      <SaveIndicator saveState={saveState} />
    </div>
  )
}

export function MobileBottomNav(_: any) { return null }
export function MobilePageDrawer(_: any) { return null }
