'use client'
import { useRef, useEffect } from 'react'
import { Page } from '../types'

// Menu contextuel (clic droit) des pages de la sidebar.
export function SidebarContextMenu({ x, y, page, isFavorite, onClose, onOpenSplit, onAddSubpage, onMoveTo, onDuplicate, onRename, onToggleFavorite, onTrash }: {
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
