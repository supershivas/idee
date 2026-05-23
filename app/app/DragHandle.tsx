'use client'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { createRoot } from 'react-dom/client'
import { useState, useEffect, useRef } from 'react'

// ─── Menu "Turn into" ─────────────────────────────────────────────────────────
const TURN_INTO = [
  { label: 'Texte',           icon: '¶',    action: (e: any) => e.chain().focus().setParagraph().run() },
  { label: 'Titre 1',         icon: 'H1',   action: (e: any) => e.chain().focus().setHeading({ level: 1 }).run() },
  { label: 'Titre 2',         icon: 'H2',   action: (e: any) => e.chain().focus().setHeading({ level: 2 }).run() },
  { label: 'Titre 3',         icon: 'H3',   action: (e: any) => e.chain().focus().setHeading({ level: 3 }).run() },
  { label: 'Liste à puces',   icon: '•',    action: (e: any) => e.chain().focus().toggleBulletList().run() },
  { label: 'Liste numérotée', icon: '1.',   action: (e: any) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Citation',        icon: '❝',    action: (e: any) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Code',            icon: '</>',  action: (e: any) => e.chain().focus().toggleCodeBlock().run() },
]

function TurnIntoMenu({ x, y, editor, onClose }: { x: number, y: number, editor: any, onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // léger délai pour éviter que le mousedown du bouton ferme immédiatement
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  const menuWidth = 192
  // Reste dans le viewport
  const left = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8))
  const menuHeight = 8 * 40 + 36 // approx
  const top = y + menuHeight > window.innerHeight ? y - menuHeight : y

  return (
    <div
      ref={ref}
      className="fixed bg-white border border-gray-200 rounded-xl shadow-xl z-[500] overflow-hidden"
      style={{ left, top, width: menuWidth }}
    >
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-2.5 pb-1">Convertir en</p>
      {TURN_INTO.map(item => (
        <button
          key={item.label}
          onMouseDown={e => {
            e.preventDefault()
            item.action(editor)
            onClose()
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-mono font-bold text-gray-600 flex-shrink-0">{item.icon}</span>
          <span className="text-sm text-gray-700">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Bouton flottant ──────────────────────────────────────────────────────────
function DragButton({ view, editor }: { view: EditorView, editor: any }) {
  // Position en coordonnées viewport (fixed)
  const [pos, setPos] = useState<{ top: number, left: number } | null>(null)
  const [menu, setMenu] = useState<{ x: number, y: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const hoveredNode = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (menu) return

      // Nœud de premier niveau dans ProseMirror
      const target = e.target as HTMLElement
      const pmNode = target.closest('.ProseMirror > *') as HTMLElement | null
      if (!pmNode) { setPos(null); hoveredNode.current = null; return }

      hoveredNode.current = pmNode
      const rect = pmNode.getBoundingClientRect()

      // Aligne sur la première ligne de texte : on prend le top du nœud
      // et on ajoute la moitié de la line-height réelle de la première ligne
      const style = window.getComputedStyle(pmNode)
      const lineH = parseFloat(style.lineHeight) || 24
      const btnSize = 20

      setPos({
        top: rect.top + (lineH / 2) - (btnSize / 2),
        // Juste à gauche du texte, collé au padding de l'éditeur
        left: rect.left - btnSize - 4,
      })
    }

    function onMouseLeave(e: MouseEvent) {
      // Ne cache pas si on survole le bouton lui-même
      const related = e.relatedTarget as HTMLElement
      if (btnRef.current?.contains(related)) return
      if (!menu) { setPos(null); hoveredNode.current = null }
    }

    const dom = view.dom
    dom.addEventListener('mousemove', onMouseMove)
    dom.addEventListener('mouseleave', onMouseLeave)
    return () => {
      dom.removeEventListener('mousemove', onMouseMove)
      dom.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [view, menu])

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setMenu({ x: rect.right + 6, y: rect.top })
  }

  function handleMouseLeaveBtn(e: React.MouseEvent) {
    const related = e.relatedTarget as HTMLElement
    if (view.dom.contains(related)) return
    if (!menu) setPos(null)
  }

  if (!pos) return null

  return (
    <>
      <button
        ref={btnRef}
        onMouseDown={e => e.preventDefault()}
        onClick={handleClick}
        onMouseLeave={handleMouseLeaveBtn}
        className="flex items-center justify-center rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors cursor-pointer select-none"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: 20,
          height: 20,
          fontSize: 13,
          lineHeight: 1,
          zIndex: 100,
          pointerEvents: 'auto',
        }}
        title="Cliquer pour convertir"
      >
        ⠿
      </button>
      {menu && (
        <TurnIntoMenu
          x={menu.x}
          y={menu.y}
          editor={editor}
          onClose={() => { setMenu(null); setPos(null) }}
        />
      )}
    </>
  )
}

// ─── Extension Tiptap ─────────────────────────────────────────────────────────
export const DragHandleExtension = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('dragHandle'),
        view(editorView) {
          const container = document.createElement('div')
          container.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:100;'
          document.body.appendChild(container)

          const root = createRoot(container)
          root.render(<DragButton view={editorView} editor={editor} />)

          return {
            destroy() {
              root.unmount()
              container.remove()
            }
          }
        }
      })
    ]
  }
})
