'use client'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { createRoot } from 'react-dom/client'
import { useState, useEffect, useRef } from 'react'

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

function moveNode(view: EditorView, nodePos: number, direction: 'up' | 'down') {
  try {
    const { state } = view
    const node = state.doc.nodeAt(nodePos)
    if (!node) return
    const nodeEnd = nodePos + node.nodeSize

    if (direction === 'up') {
      // Trouve le nœud précédent
      const $pos = state.doc.resolve(nodePos)
      if (nodePos === 0) return
      const prevPos = nodePos - 1
      const $prev = state.doc.resolve(prevPos)
      const prevNodePos = $prev.before($prev.depth > 0 ? $prev.depth : 1)
      const prevNode = state.doc.nodeAt(prevNodePos)
      if (!prevNode) return
      const tr = state.tr
        .delete(nodePos, nodeEnd)
        .insert(prevNodePos, node)
      view.dispatch(tr)
    } else {
      // Trouve le nœud suivant
      const nextPos = nodeEnd
      if (nextPos >= state.doc.content.size) return
      const nextNode = state.doc.nodeAt(nextPos)
      if (!nextNode) return
      const tr = state.tr
        .insert(nodePos, nextNode)
        .delete(nodeEnd + nextNode.nodeSize, nodeEnd + nextNode.nodeSize * 2)
      // Approche plus simple : delete les deux et réinsère dans l'ordre inverse
      const tr2 = state.tr
        .delete(nodePos, nodeEnd + nextNode.nodeSize)
        .insert(nodePos, nextNode)
        .insert(nodePos + nextNode.nodeSize, node)
      view.dispatch(tr2)
    }
  } catch (err) {
    console.warn('moveNode error:', err)
  }
}

function BlockMenu({ x, y, editor, nodePos, view, onClose }: {
  x: number, y: number, editor: any, nodePos: number, view: EditorView, onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      function handler(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose()
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, 50)
    return () => clearTimeout(t)
  }, [onClose])

  const menuWidth = 200
  const left = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8))
  const menuHeight = 340
  const top = y + menuHeight > window.innerHeight ? y - menuHeight : y

  function Item({ icon, label, onClick, danger }: { icon: string, label: string, onClick: () => void, danger?: boolean }) {
    return (
      <button
        style={{ pointerEvents: 'auto' }}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onClick() }}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors
          ${danger ? 'text-red-500 hover:bg-red-50' : ''}`}
      >
        <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-mono font-bold text-gray-600 flex-shrink-0">
          {icon}
        </span>
        <span className="text-sm text-gray-700">{label}</span>
      </button>
    )
  }

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, width: menuWidth, zIndex: 9999, pointerEvents: 'auto' }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
    >
      {/* Déplacer */}
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-2.5 pb-1">Déplacer</p>
      <Item icon="↑" label="Vers le haut" onClick={() => { moveNode(view, nodePos, 'up'); onClose() }} />
      <Item icon="↓" label="Vers le bas"  onClick={() => { moveNode(view, nodePos, 'down'); onClose() }} />

      <div className="border-t border-gray-100 my-1" />

      {/* Convertir */}
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-1.5 pb-1">Convertir en</p>
      {TURN_INTO.map(item => (
        <button
          key={item.label}
          style={{ pointerEvents: 'auto' }}
          onMouseDown={e => {
            e.preventDefault()
            e.stopPropagation()
            try {
              const { state, dispatch } = editor.view
              const $pos = state.doc.resolve(Math.min(nodePos + 1, state.doc.content.size - 1))
              dispatch(state.tr.setSelection(TextSelection.create(state.doc, $pos.pos)))
            } catch {}
            item.action(editor)
            onClose()
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-mono font-bold text-gray-600 flex-shrink-0">
            {item.icon}
          </span>
          <span className="text-sm text-gray-700">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

function DragButton({ view, editor }: { view: EditorView, editor: any }) {
  const [pos, setPos] = useState<{ top: number, left: number } | null>(null)
  const [menu, setMenu] = useState<{ x: number, y: number, nodePos: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentNodeRef = useRef<HTMLElement | null>(null)
  const currentNodePosRef = useRef<number>(0)

  function clearHide() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }
  function scheduleHide() {
    clearHide()
    hideTimer.current = setTimeout(() => { if (!menu) setPos(null) }, 150)
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (menu) return
      clearHide()
      const target = e.target as HTMLElement
      const pmNode = target.closest('.ProseMirror > *') as HTMLElement | null
      if (!pmNode) { scheduleHide(); return }
      currentNodeRef.current = pmNode
      try {
        const domPos = view.posAtDOM(pmNode, 0)
        const $pos = view.state.doc.resolve(domPos)
        currentNodePosRef.current = $pos.depth > 0 ? $pos.before($pos.depth) : 0
      } catch {
        currentNodePosRef.current = 0
      }
      const rect = pmNode.getBoundingClientRect()
      const style = window.getComputedStyle(pmNode)
      const lineH = parseFloat(style.lineHeight) || 24
      const btnSize = 24
      setPos({ top: rect.top + (lineH / 2) - (btnSize / 2), left: rect.left - btnSize - 6 })
    }
    function onMouseLeave() { scheduleHide() }
    const dom = view.dom
    dom.addEventListener('mousemove', onMouseMove)
    dom.addEventListener('mouseleave', onMouseLeave)
    return () => {
      dom.removeEventListener('mousemove', onMouseMove)
      dom.removeEventListener('mouseleave', onMouseLeave)
      clearHide()
    }
  }, [view, menu])

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setMenu({ x: rect.right + 6, y: rect.top, nodePos: currentNodePosRef.current })
  }

  if (!pos) return null

  return (
    <>
      <button
        ref={btnRef}
        onMouseDown={e => e.preventDefault()}
        onClick={handleClick}
        onMouseEnter={clearHide}
        onMouseLeave={() => { if (!menu) scheduleHide() }}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: 24,
          height: 24,
          fontSize: 16,
          zIndex: 100,
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
        className="flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors select-none"
        title="Cliquer pour déplacer ou convertir"
      >⠿</button>
      {menu && (
        <BlockMenu
          x={menu.x}
          y={menu.y}
          nodePos={menu.nodePos}
          editor={editor}
          view={view}
          onClose={() => { setMenu(null); setPos(null) }}
        />
      )}
    </>
  )
}

export const DragHandleExtension = Extension.create({
  name: 'dragHandle',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [new Plugin({
      key: new PluginKey('dragHandle'),
      view(editorView) {
        const container = document.createElement('div')
        // ⚠️ pointer-events:none sur le container, mais auto sur les enfants
        container.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:100;'
        document.body.appendChild(container)
        const root = createRoot(container)
        root.render(<DragButton view={editorView} editor={editor} />)
        return { destroy() { root.unmount(); container.remove() } }
      }
    })]
  }
})
