'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'
import ShareButton from './ShareButton'
import ExportButton from './ExportButton'
import HistoryButton from './HistoryButton'
import EmojiPicker from './EmojiPicker'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { Page, colorBg, formatSubtitle } from './types'
import { useIsMobile, useToggleFavorite } from './hooks'
import { SearchBar } from './components/SearchBar'
import { TrashPanel } from './components/TrashPanel'
import { PageTree, Breadcrumb, FavoritesSection } from './components/PageTree'
import { SubpagesList } from './components/SubpagesList'
import { MobileHomeView, MobileTopBar } from './components/MobileNav'
import { ActionsMenu, ConfirmTrashModal } from './components/ActionsMenu'
import { JournalList, JournalEntryHeader } from './components/JournalView'
import { SettingsPanel, useTheme } from './components/SettingsPanel'
// Breadcrumb inline (ancêtres uniquement, sans la page courante)
function BreadcrumbInline({ pages, selected, onSelect }: { pages: Page[], selected: Page | null, onSelect: (p: Page) => void }) {
  if (!selected) return null
  const crumbs: Page[] = []
  let current: Page | undefined = selected
  while (current) { crumbs.unshift(current); current = pages.find(p => p.id === current!.parent_id) }
  const ancestors = crumbs.slice(0, -1)
  if (ancestors.length === 0) return <div className="flex-1 min-w-0" />
  return (
    <div className="flex items-center gap-1 text-xs text-gray-400 flex-1 min-w-0 overflow-x-auto">
      {ancestors.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
          {i > 0 && <span className="text-gray-200">/</span>}
          <button onClick={() => onSelect(crumb)} className="hover:text-gray-600 transition-colors flex items-center gap-1 py-1">
            <span>{crumb.icon || '📄'}</span>
            <span className="whitespace-nowrap">{crumb.title || 'Sans titre'}</span>
          </button>
        </span>
      ))}
      <span className="text-gray-200 flex-shrink-0">/</span>
    </div>
  )
}
// Wrapper discret pour les boutons d'action (rend le bouton enfant plus petit)
function PageActionBtn({ children, title, onClick }: { children: React.ReactNode, title: string, onClick: () => void }) {
  return (
    <div className="[&_button]:!text-xs [&_button]:!text-gray-300 [&_button]:hover:!text-gray-600 [&_button]:!px-1.5 [&_button]:!py-1 [&_button]:!rounded [&_button]:hover:!bg-gray-100 [&_button]:transition-colors" title={title}>
      {children}
    </div>
  )
}
export type { Page }
const lastPageKey = (userId: string) => `idee_last_page_${userId}`
// Remonte tous les ancêtres d'une page pour les ouvrir dans la sidebar
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
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [showJournal, setShowJournal] = useState(false)
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
  // Restaure la dernière page ouverte au chargement
  const [selected, setSelected] = useState<Page | null>(() => {
    if (typeof window === 'undefined') return null
    const lastId = localStorage.getItem(lastPageKey(userId))
    return initialPages.find(p => p.id === lastId && !p.deleted_at) || null
  })
  // Titre dynamique
  useEffect(() => {
    document.title = selected ? `Idée · ${selected.title || 'Sans titre'}` : 'Idée'
  }, [selected?.title, selected?.id])

  const selectPage = useCallback((page: Page | null) => {    setSelected(page)
    if (!page) return
    try { localStorage.setItem(lastPageKey(userId), page.id) } catch {}
    setOpenMap(() => {
      const allPages = [...pages, ...initialPages]
      const current = allPages.find(p => p.id === page.id)
      if (!current) return {}
      const toOpen: string[] = []
      // Ouvre la page elle-même si elle a des enfants
      const hasChildren = allPages.some(p => p.parent_id === page.id && !p.deleted_at)
      if (hasChildren) toOpen.push(page.id)
      // Ouvre tous les ancêtres
      let c = current
      while (c?.parent_id) {
        toOpen.push(c.parent_id)
        c = allPages.find(p => p.id === c!.parent_id) as Page
      }
      // Si c'est une page racine (pas de parent) → reset complet, on repart de zéro
      // Si c'est une sous-page → on conserve l'openMap existant et on ajoute
      if (!current.parent_id) {
        const next: Record<string, boolean> = {}
        toOpen.forEach(id => { next[id] = true })
        return next
      }
      // Sous-page : on garde ce qui est ouvert et on ajoute les ancêtres
      const next: Record<string, boolean> = {}
      toOpen.forEach(id => { next[id] = true })
      return next
    })
  }, [pages, userId])
  // Restaure l'expand au chargement pour la page persistée
  useEffect(() => {
    if (!selected) return
    const ancestorIds = getAncestorIds(initialPages, selected.id)
    const hasChildren = initialPages.some(p => p.parent_id === selected.id && !p.deleted_at)
    const toOpen = hasChildren ? [selected.id, ...ancestorIds] : ancestorIds
    if (toOpen.length > 0) {
      setOpenMap(prev => {
        const next = { ...prev }
        toOpen.forEach(id => { next[id] = true })
        return next
      })
    }
  }, []) // une seule fois au mount // se déclenche uniquement quand l'id change
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
  async function updateColor(id: string, color: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, color } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, color } : null)
    await createClient().from('pages').update({ color: color || null }).eq('id', id)
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
  return (
    <div className="flex w-full h-screen bg-white overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden md:flex flex-col border-r flex-shrink-0 bg-gray-50 relative" style={{ width: `${sidebarWidth}px` }}>
        {/* Drag handle */}
        <div
          onMouseDown={startResize}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-300 transition-colors group"
          title="Redimensionner"
        >
          <div className="absolute right-0 top-0 bottom-0 w-4 -translate-x-1.5" />
        </div>
        <div className="px-4 flex items-center justify-between border-b border-gray-200" style={{ minHeight: '52px' }}>
          <span className="font-semibold text-gray-800 text-sm">Idée</span>
          <div className="flex items-center gap-1">
            <button onClick={() => addPage(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 text-xl">+</button>
            <button onClick={() => setShowTrash(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 relative">
              🗑{trashedPages.length > 0 && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-400 text-white text-[9px] rounded-full flex items-center justify-center">{trashedPages.length}</span>}
            </button>
            <button onClick={logout} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400">⎋</button>
            <button onClick={() => setShowSettings(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400" title="Paramètres">⚙️</button>
          </div>
        </div>
        <SearchBar pages={[...activePages, ...journalEntries]} onSelect={selectPage} />
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {activePages.filter(p => p.parent_id === null).length === 0 && <p className="text-xs text-gray-400 px-3 py-3">Clique sur + pour créer une page.</p>}
          <FavoritesSection pages={activePages} selectedId={selected?.id || null} onSelect={selectPage} onToggleFavorite={toggleFavorite} />
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <PageTree pages={activePages} parentId={null} depth={0} selectedId={selected?.id || null}
              onSelect={selectPage} onAdd={addPage} onToggle={toggleOpen} openMap={openMap}
              overId={overId} overPosition={overPosition} isMobile={false}
              onRename={renamePage} onColorChange={updateColor} onToggleFavorite={toggleFavorite} />
            <DragOverlay>
              {activeDragPage && <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-lg text-sm opacity-90"><span>{activeDragPage.icon}</span><span className="truncate max-w-32">{activeDragPage.title || 'Sans titre'}</span></div>}
            </DragOverlay>
          </DndContext>
        </div>
        {/* Journal — entrée fixe en bas de sidebar */}
        <div className="flex-shrink-0 border-t border-gray-200 px-2 py-2">
          <button
            onClick={() => { setShowJournal(true); setSelected(null) }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
              ${showJournal ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-200/60'}`}
          >
            <span>📓</span>
            <span className="flex-1 text-left">Journal</span>
            <span className="text-xs text-gray-400">{journalEntries.length || ''}</span>
          </button>
        </div>
      </div>
      {/* Mobile : vue liste ou vue page */}
      {isMobile && !selected && !showJournal && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <MobileHomeView
            pages={[...activePages, ...journalEntries]}
            selectedId={null}
            onSelect={p => { selectPage(p); setShowJournal(false) }}
            onAdd={() => addPage(null)}
            onShowTrash={() => setShowTrash(true)}
            trashedCount={trashedPages.length}
            onToggleFavorite={toggleFavorite}
            onShowJournal={() => setShowJournal(true)}
            journalCount={journalEntries.length}
          />
        </div>
      )}
      {/* Vue Journal mobile */}
      {isMobile && showJournal && !selected && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2 flex-shrink-0">
            <button onClick={() => setShowJournal(false)} className="text-sm text-gray-500">← Pages</button>
          </div>
          <JournalList
            entries={journalEntries}
            selectedId={null}
            onSelect={p => { selectPage(p); setShowJournal(false) }}
            onAdd={addJournalEntry}
          />
        </div>
      )}
      {showTrash && <TrashPanel trashedPages={trashedPages} onRestore={restorePage} onDeleteForever={deleteForever} onClose={() => setShowTrash(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onLogout={logout} pages={pages} userId={userId} userEmail={userEmail} />}
      {/* Contenu desktop — journal liste */}
      {!isMobile && showJournal && !selected && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <JournalList
            entries={journalEntries}
            selectedId={null}
            onSelect={p => { selectPage(p); setShowJournal(false) }}
            onAdd={addJournalEntry}
          />
        </div>
      )}
      {/* Contenu — page normale ou entrée journal */}
      <div className={`${(isMobile && !selected) || (!isMobile && showJournal && !selected) ? 'hidden' : ''} flex-1 flex flex-col overflow-y-auto min-w-0 transition-colors ${selected?.color ? colorBg(selected.color) : ''}`}>
        {selected ? (
          <div className="page-card my-4 mx-3 md:mx-auto md:my-6 flex flex-col flex-1">
            {selected.type === 'journal' ? (
              /* ── Entrée journal ── */
              <>
                <div className="hidden md:flex items-center justify-between border-b border-gray-100 px-4 md:px-8" style={{ minHeight: '40px' }}>
                  <button onClick={() => { setSelected(null); setShowJournal(true) }} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1">← Journal</button>
                  <div className="flex items-center gap-0.5">
                    <span className={`w-5 h-5 flex items-center justify-center text-xs transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    </span>
                    <button onClick={() => setConfirmDeleteId(selected.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors text-sm" title="Supprimer">🗑</button>
                  </div>
                </div>
                <MobileTopBar onBack={() => { setSelected(null); setShowJournal(true) }} saving={saving} />
                <JournalEntryHeader
                  entry={selected}
                  onBack={() => { setSelected(null); setShowJournal(true) }}
                  onTitleChange={updateTitle}
                  onIconChange={(emoji) => updateIcon(selected.id, emoji)}
                  saving={saving}
                  isMobile={isMobile}
                />
                <Editor key={selected.id} page={selected} pages={[...activePages, ...journalEntries]} onUpdate={updateContent} onAddSubpage={() => {}} onNavigate={p => { selectPage(p); setShowJournal(false) }} userId={userId} isMobile={isMobile} />
              </>
            ) : (
              /* ── Page normale ── */
              <>
                <div className="hidden md:flex items-center justify-between border-b border-gray-100 px-4 md:px-8" style={{ minHeight: '40px' }}>
                  <BreadcrumbInline pages={activePages} selected={selected} onSelect={selectPage} />
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <span className={`w-5 h-5 flex items-center justify-center text-xs transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`} title="Sauvegarde...">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    </span>
                    <PageActionBtn onClick={() => {}} title="Historique"><HistoryButton page={selected} onRestore={(title, content) => { setSelected(prev => prev ? { ...prev, title, content } : null); setPages(prev => prev.map(p => p.id === selected.id ? { ...p, title, content } : p)) }} /></PageActionBtn>
                    <PageActionBtn onClick={() => {}} title="Exporter"><ExportButton page={selected} /></PageActionBtn>
                    <PageActionBtn onClick={() => {}} title="Partager"><ShareButton page={selected as any} onUpdate={(updates) => { setSelected(prev => prev ? { ...prev, ...updates } : null); setPages(prev => prev.map(p => p.id === selected.id ? { ...p, ...updates } : p)) }} /></PageActionBtn>
                    <button onClick={() => convertToJournal(selected.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors text-sm" title="Convertir en entrée Journal">📓</button>
                    <button onClick={() => setConfirmDeleteId(selected.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors text-sm" title="Supprimer">🗑</button>
                  </div>
                </div>
                <MobileTopBar onBack={() => setSelected(null)} saving={saving} />
                <div className="px-4 md:px-8 pt-4 pb-2">
                  <div className="flex items-start gap-3 group/title" style={{ maxWidth: '720px' }}>
                    <div className="relative flex-shrink-0">
                      <button onClick={() => setShowIconPicker(v => !v)} className="text-4xl hover:opacity-70 transition-opacity" style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{selected.icon || '📄'}</button>
                      {showIconPicker && <div className={isMobile ? 'fixed inset-x-4 top-20 z-50' : 'absolute top-full left-0 z-50'}><EmojiPicker onSelect={(emoji) => { updateIcon(selected.id, emoji); setShowIconPicker(false) }} onClose={() => setShowIconPicker(false)} /></div>}
                    </div>
                    <input className="page-title flex-1 text-2xl md:text-3xl outline-none bg-transparent placeholder-gray-300 min-w-0 pt-1" style={{ minHeight: '44px' }} value={selected.title} onChange={e => updateTitle(e.target.value)} placeholder="Sans titre" />
                    <button
                      onClick={() => toggleFavorite(selected.id)}
                      className={`flex-shrink-0 mt-2 text-xl transition-all ${selected.favorite ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover/title:opacity-100 text-gray-300 hover:text-amber-400'}`}
                      title={selected.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      {selected.favorite ? '★' : '☆'}
                    </button>
                  </div>
                </div>
                <SubpagesList subpages={subpages} onSelect={selectPage} onReorder={(a, o, p) => reorderSiblings(a, o, p)} isMobile={isMobile} onAddSubpage={() => addPage(selected.id)} />
                <Editor key={selected.id} page={selected} pages={[...activePages, ...journalEntries]} onUpdate={updateContent} onAddSubpage={() => addPage(selected.id)} onNavigate={p => { selectPage(p); if (p.type === 'journal') setShowJournal(false) }} userId={userId} isMobile={isMobile} />
              </>
            )}
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-4xl mb-3">💡</p>
              <p className="text-lg font-medium mb-1 text-gray-500">Aucune page sélectionnée</p>
              <button onClick={() => addPage(null)} className="text-sm text-blue-500 hover:text-blue-700 underline">Créer une page</button>
            </div>
          </div>
        )}
      </div>
      {confirmDeleteId && (() => { const page = pages.find(p => p.id === confirmDeleteId); if (!page) return null; return <ConfirmTrashModal page={page} onConfirm={() => { deletePage(confirmDeleteId); setConfirmDeleteId(null) }} onCancel={() => setConfirmDeleteId(null)} /> })()}
    </div>
  )
}
