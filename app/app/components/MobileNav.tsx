'use client'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { Page } from '../types'
import { PageTree } from './PageTree'
import { SearchBar } from './SearchBar'

function getAncestorIds(pages: Page[], page: Page): string[] {
  const ids: string[] = []
  let current: Page | undefined = pages.find(p => p.id === page.parent_id)
  while (current) { ids.push(current.id); current = pages.find(p => p.id === current!.parent_id) }
  return ids
}

export function MobileBottomNav({ pages, selected, onSelect, onAdd, onShowAll }: {
  pages: Page[], selected: Page | null,
  onSelect: (p: Page) => void, onAdd: () => void, onShowAll: () => void
}) {
  const rootPages = pages.filter(p => p.parent_id === null && !p.deleted_at).sort((a, b) => a.position - b.position)
  const navPages = rootPages.slice(0, 3)
  const hasMore = rootPages.length > 3

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-stretch">
        {navPages.map(page => (
          <button key={page.id} onClick={() => onSelect(page)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors min-w-0
              ${selected?.id === page.id || (selected && getAncestorIds(pages, selected).includes(page.id))
                ? 'text-gray-900' : 'text-gray-400'}`}
            style={{ minHeight: '56px' }}>
            <span className="text-xl leading-none">{page.icon || '📄'}</span>
            {page.title && <span className="text-[10px] truncate w-full text-center px-1 leading-tight">{page.title}</span>}
          </button>
        ))}
        {hasMore && (
          <button onClick={onShowAll} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-gray-400" style={{ minHeight: '56px' }}>
            <span className="text-xl leading-none">☰</span>
            <span className="text-[10px]">Pages</span>
          </button>
        )}
        <div className="w-px bg-gray-100 my-2" />
        <button onClick={onAdd} className="flex-none flex flex-col items-center justify-center gap-0.5 px-4 py-2 text-gray-400" style={{ minHeight: '56px' }}>
          <span className="text-xl leading-none">＋</span>
          <span className="text-[10px]">Nouveau</span>
        </button>
      </div>
    </div>
  )
}

export function MobilePageDrawer({ pages, trashedCount, selected, onSelect, onAdd, onClose, onShowTrash, openMap, onToggle, overId, overPosition, sensors, onDragStart, onDragOver, onDragEnd, activePage, onRename, onColorChange }: {
  pages: Page[], trashedCount: number, selected: Page | null,
  onSelect: (p: Page) => void, onAdd: (id: string | null) => void,
  onClose: () => void, onShowTrash: () => void,
  openMap: Record<string, boolean>, onToggle: (id: string) => void,
  overId: string | null, overPosition: 'before' | 'after' | 'inside' | null,
  sensors: any, onDragStart: any, onDragOver: any, onDragEnd: any,
  activePage: Page | undefined,
  onRename: (id: string, title: string) => void,
  onColorChange: (id: string, color: string) => void,
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <span className="font-semibold text-gray-800">Pages</span>
          <div className="flex items-center gap-2">
            <button onClick={onShowTrash}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 relative">
              🗑 Corbeille
              {trashedCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 text-white text-[10px] rounded-full flex items-center justify-center">{trashedCount}</span>
              )}
            </button>
            <button onClick={() => onAdd(null)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-xl">+</button>
          </div>
        </div>
        <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
          <SearchBar pages={pages} onSelect={(p) => { onSelect(p); onClose() }} />
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
            <PageTree pages={pages} parentId={null} depth={0} selectedId={selected?.id || null}
              onSelect={(p) => { onSelect(p); onClose() }}
              onAdd={onAdd} onToggle={onToggle} openMap={openMap}
              overId={overId} overPosition={overPosition} isMobile={true}
              onRename={onRename} onColorChange={onColorChange} />
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
