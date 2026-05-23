'use client'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { createRoot } from 'react-dom/client'
import { useState, useEffect, useRef } from 'react'

// ─── Menu "Turn into" ─────────────────────────────────────────────────────────
const TURN_INTO = [
  { label: 'Texte',            icon: '¶',   action: (e: any) => e.chain().focus().setParagraph().run() },
  { label: 'Titre 1',          icon: 'H1',  action: (e: any) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Titre 2',          icon: 'H2',  action: (e: any) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Titre 3',          icon: 'H3',  action: (e: any) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Liste à puces',    icon: '•',   action: (e: any) => e.chain().focus().toggleBulletList().run() },
  { label: 'Liste numérotée',  icon: '1.',  action: (e: any) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Citation',         icon: '❝',   action: (e: any) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Code',             icon: '</>',  action: (e: any) => e.chain().focus().toggleCodeBlock().run() },
]

function TurnIntoMenu({ x, y, editor, onClose }: { x: number, y: number, editor: any, onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Ajuste la position pour rester dans le viewport
  const menuWidth = 180
  const left = Math.min(x, window.innerWidth - menuWidth - 8)

  return (
    <div
      ref={ref}
      className="fixed bg-white border border-gray-200 rounded-xl shadow-xl z-[200] overflow-hidden"
      style={{ left, top: y, width: menuWidth }}
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
  const [pos, setPos] = useState<{ top: number, left: number } | null>(null)
  const [menu, setMenu] = useState<{ x: number, y: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const currentNodePos = useRef<number | null>(null)

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (menu) return
      const target = e.target as HTMLElement
      // Trouve le nœud ProseMirror le plus proche
      const pmNode = target.closest('.ProseMirror > *') as HTMLElement
      if (!pmNode || !pmNode.parentElement) { setPos(null); return }

      const editorRect = view.dom.getBoundingClientRect()
      const nodeRect = pmNode.getBoundingClientRect()

      // Position du bouton : centré verticalement sur la première ligne du nœud
      const lineHeight = 28
      setPos({
        top: nodeRect.top - editorRect.top + Math.min(lineHeight / 2, nodeRect.height / 2) - 10,
        left: -28, // à gauche du contenu
      })

      // Mémorise la position ProseMirror du nœud pour le drag
      try {
        const pos = view.posAtDOM(pmNode, 0)
        currentNodePos.current = pos
      } catch {}
    }

    function onMouseLeave() {
      if (!menu) setPos(null)
    }

    const dom = view.dom
    dom.addEventListener('mousemove', onMouseMove)
    dom.parentElement?.addEventListener('mouseleave', onMouseLeave)
    return () => {
      dom.removeEventListener('mousemove', onMouseMove)
      dom.parentElement?.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [view, menu])

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setMenu({ x: rect.right + 4, y: rect.top })
  }

  if (!pos) return null

  return (
    <>
      <button
        ref={btnRef}
        onMouseDown={e => e.preventDefault()}
        onClick={handleClick}
        className="absolute flex items-center justify-center rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors cursor-pointer select-none"
        style={{
          top: pos.top,
          left: pos.left,
          width: 20,
          height: 20,
          fontSize: 14,
          lineHeight: 1,
          zIndex: 10,
        }}
        title="Cliquer : convertir — Glisser : déplacer"
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
          // Crée un conteneur positionné par-dessus l'éditeur
          const wrapper = document.createElement('div')
          wrapper.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:visible;'

          // Monte le composant React dans ce conteneur
          const container = document.createElement('div')
          container.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;'
          wrapper.appendChild(container)

          const editorDom = editorView.dom
          const parent = editorDom.parentElement
          if (parent) {
            parent.style.position = 'relative'
            parent.appendChild(wrapper)
          }

          // Rend le bouton avec pointer-events activés
          const btnWrapper = document.createElement('div')
          btnWrapper.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;'
          wrapper.appendChild(btnWrapper)

          const root = createRoot(btnWrapper)
          root.render(
            <div style={{ pointerEvents: 'auto' }}>
              <DragButton view={editorView} editor={editor} />
            </div>
          )

          return {
            destroy() {
              root.unmount()
              wrapper.remove()
            }
          }
        }
      })
    ]
  }
})
