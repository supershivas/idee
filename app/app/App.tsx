'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'
import ShareButton from './ShareButton'
import ExportButton from './ExportButton'
import HistoryButton from './HistoryButton'
import EmojiPicker from './EmojiPicker'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { Page, colorBg } from './types'
import { useIsMobile } from './hooks'
import { SearchBar } from './components/SearchBar'
import { TrashPanel } from './components/TrashPanel'
import { PageTree, Breadcrumb } from './components/PageTree'
import { MobileBottomNav, MobilePageDrawer } from './components/MobileNav'
import { ActionsMenu, ConfirmTrashModal } from './components/ActionsMenu'

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

export default function App({ initialPages, userId }: { initialPages: Page[], userId: string }) {
  const [pages, setPages] = useState<Page[]>(initialPages)
  const [saving, setSaving] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overPosition, setOverPosition] = useState<'before' | 'after' | 'inside' | null>(null)
  const lastSaveRef = useRef(0)
  const isMobile = useIsMobile()

  const activePages = pages.filter(p => !p.deleted_at)
  const trashedPages = pages.filter(p => !!p.deleted_at)

  // Restaure la dernière page ouverte au chargement
  const [selected, setSelected] = useState<Page | null>(() => {
    if (typeof window === 'undefined') return null
    const lastId = localStorage.getItem(lastPageKey(userId))
    return initialPages.find(p => p.id === lastId && !p.deleted_at) || null
  })

  const selectPage = useCallback((page: Page | null) => {
    setSelected(page)
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
    const supabase = createClient()
    const icons = ['📄','📝','💡','🗂️','📌','🔖','⭐','🚀','🎯','💬']
    const icon = icons[Math.floor(Math.random() * icons.length)]
    const { data } = await supabase.from('pages')
      .insert({ title: 'Sans titre', content: '', user_id: userId, parent_id: parentId, position: pages.length, icon })
      .select().single()
    if (data) { setPages(prev => [...prev, data]); selectPage(data); setShowDrawer(false); if (parentId) setOpenMap(o => ({ ...o, [parentId]: true })) }
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
    const deletedAt = new Date().toISOString()
    setPages(prev => prev.map(p => p.id === id || p.parent_id === id ? { ...p, deleted_at: deletedAt } : p))
    if (selected?.id === id) setSelected(activePages.find(p => p.id !== id) || null)
    const supabase = createClient()
    await supabase.from('pages').update({ deleted_at: deletedAt }).eq('id', id)
    const children = pages.filter(p => p.parent_id === id)
    if (children.length) await supabase.from('pages').update({ deleted_at: deletedAt }).in('id', children.map(c => c.id))
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

  const activeDragPage = pages.find(p => p.id === activeDragId)

  return (
    <div className="flex w-full h-screen bg-white overflow-hidden">

      {/* Sidebar desktop */}
      <div className="hidden md:flex flex-col border-r flex-shrink-0 bg-gray-50" style={{ width: '240px' }}>
        <div className="px-4 flex items-center justify-between border-b border-gray-200" style={{ minHeight: '52px' }}>
          <span className="font-semibold text-gray-800 text-sm">Idée</span>
          <div className="flex items-center gap-1">
            <button onClick={() => addPage(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 text-xl">+</button>
            <button onClick={() => setShowTrash(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 relative">
              🗑{trashedPages.length > 0 && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-400 text-white text-[9px] rounded-full flex items-center justify-center">{trashedPages.length}</span>}
            </button>
            <button onClick={logout} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400">⎋</button>
          </div>
        </div>
        <SearchBar pages={activePages} onSelect={selectPage} />
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {activePages.filter(p => p.parent_id === null).length === 0 && <p className="text-xs text-gray-400 px-3 py-3">Clique sur + pour créer une page.</p>}
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <PageTree pages={activePages} parentId={null} depth={0} selectedId={selected?.id || null}
              onSelect={selectPage} onAdd={addPage} onToggle={toggleOpen} openMap={openMap}
              overId={overId} overPosition={overPosition} isMobile={false}
              onRename={renamePage} onColorChange={updateColor} />
            <DragOverlay>
              {activeDragPage && <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-lg text-sm opacity-90"><span>{activeDragPage.icon}</span><span className="truncate max-w-32">{activeDragPage.title || 'Sans titre'}</span></div>}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {showDrawer && <MobilePageDrawer pages={activePages} trashedCount={trashedPages.length} selected={selected} onSelect={selectPage} onAdd={addPage} onClose={() => setShowDrawer(false)} onShowTrash={() => { setShowDrawer(false); setShowTrash(true) }} openMap={openMap} onToggle={toggleOpen} overId={overId} overPosition={overPosition} sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} activePage={activeDragPage} onRename={renamePage} onColorChange={updateColor} />}
      {showTrash && <TrashPanel trashedPages={trashedPages} onRestore={restorePage} onDeleteForever={deleteForever} onClose={() => setShowTrash(false)} />}

      {/* Contenu */}
      <div className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-colors ${selected?.color ? colorBg(selected.color) : ''}`}
        style={{ paddingBottom: isMobile ? '56px' : '0' }}>
        {selected ? (
          <>
            {/* Topbar : breadcrumb + actions au même niveau */}
            <div className="hidden md:flex items-center justify-between border-b border-gray-100 px-4 md:px-8" style={{ minHeight: '40px' }}>
              {/* Breadcrumb */}
              <BreadcrumbInline pages={activePages} selected={selected} onSelect={selectPage} />
              {/* Actions discrètes */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {/* Indicateur sauvegarde */}
                <span className={`w-5 h-5 flex items-center justify-center text-xs transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`} title="Sauvegarde...">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                </span>
                <PageActionBtn onClick={() => {}} title="Historique"><HistoryButton page={selected} onRestore={(title, content) => { setSelected(prev => prev ? { ...prev, title, content } : null); setPages(prev => prev.map(p => p.id === selected.id ? { ...p, title, content } : p)) }} /></PageActionBtn>
                <PageActionBtn onClick={() => {}} title="Exporter"><ExportButton page={selected} /></PageActionBtn>
                <PageActionBtn onClick={() => {}} title="Partager"><ShareButton page={selected as any} onUpdate={(updates) => { setSelected(prev => prev ? { ...prev, ...updates } : null); setPages(prev => prev.map(p => p.id === selected.id ? { ...p, ...updates } : p)) }} /></PageActionBtn>
                <button onClick={() => setConfirmDeleteId(selected.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors text-sm" title="Supprimer">🗑</button>
              </div>
            </div>

            {/* Header mobile : icône save + menu ··· */}
            <div className="md:hidden flex items-center justify-end gap-1 px-4 pt-2">
              <span className={`w-5 h-5 flex items-center justify-center transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              </span>
              <ActionsMenu onDelete={() => setConfirmDeleteId(selected.id)}>
                <div className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"><ExportButton page={selected} /></div>
                <div className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"><ShareButton page={selected as any} onUpdate={(updates) => { setSelected(prev => prev ? { ...prev, ...updates } : null); setPages(prev => prev.map(p => p.id === selected.id ? { ...p, ...updates } : p)) }} /></div>
                <div className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"><HistoryButton page={selected} onRestore={(title, content) => { setSelected(prev => prev ? { ...prev, title, content } : null); setPages(prev => prev.map(p => p.id === selected.id ? { ...p, title, content } : p)) }} /></div>
              </ActionsMenu>
            </div>

            {/* Icône + Titre */}
            <div className="px-4 md:px-8 pt-4 pb-2">
              <div className="flex items-start gap-3" style={{ maxWidth: '720px' }}>
                <div className="relative flex-shrink-0">
                  <button onClick={() => setShowIconPicker(v => !v)} className="text-4xl hover:opacity-70 transition-opacity" style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{selected.icon || '📄'}</button>
                  {showIconPicker && <div className={isMobile ? 'fixed inset-x-4 top-20 z-50' : 'absolute top-full left-0 z-50'}><EmojiPicker onSelect={(emoji) => { updateIcon(selected.id, emoji); setShowIconPicker(false) }} onClose={() => setShowIconPicker(false)} /></div>}
                </div>
                <input className="flex-1 text-2xl md:text-3xl font-bold outline-none bg-transparent text-gray-900 placeholder-gray-300 min-w-0 pt-1" style={{ minHeight: '44px' }} value={selected.title} onChange={e => updateTitle(e.target.value)} placeholder="Sans titre" />
              </div>
            </div>
            <Editor key={selected.id} page={selected} pages={activePages} onUpdate={updateContent} onAddSubpage={() => addPage(selected.id)} onNavigate={selectPage} userId={userId} isMobile={isMobile} />
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

      {confirmDeleteId && (() => { const page = pages.find(p => p.id === confirmDeleteId); if (!page) return null; return <ConfirmTrashModal page={page} onConfirm={() => { deletePage(confirmDeleteId); setConfirmDeleteId(null) }} onCancel={() => setConfirmDeleteId(null)} /> })()}
      <MobileBottomNav pages={activePages} selected={selected} onSelect={selectPage} onAdd={() => addPage(null)} onShowAll={() => setShowDrawer(true)} />
    </div>
  )
}
