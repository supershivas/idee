'use client'
import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { createRoot } from 'react-dom/client'
import { useState, useEffect, useRef } from 'react'

type TiptapEditor = Editor

const TURN_INTO: { label: string; icon: string; action: (e: TiptapEditor) => void }[] = [
  { label: 'Texte',           icon: 'ti-pilcrow',    action: e => e.chain().focus().setParagraph().run() },
  { label: 'Titre 1',         icon: 'ti-h-1',   action: e => e.chain().focus().setHeading({ level: 1 }).run() },
  { label: 'Titre 2',         icon: 'ti-h-2',   action: e => e.chain().focus().setHeading({ level: 2 }).run() },
  { label: 'Titre 3',         icon: 'ti-h-3',   action: e => e.chain().focus().setHeading({ level: 3 }).run() },
  { label: 'Liste à puces',   icon: 'ti-list',    action: e => e.chain().focus().toggleBulletList().run() },
  { label: 'Liste numérotée', icon: 'ti-list-numbers',   action: e => e.chain().focus().toggleOrderedList().run() },
  { label: 'Citation',        icon: 'ti-quote',    action: e => e.chain().focus().toggleBlockquote().run() },
  { label: 'Code',            icon: 'ti-source-code',  action: e => e.chain().focus().toggleCodeBlock().run() },
]

function moveNode(view: EditorView, nodePos: number, direction: 'up' | 'down') {
  try {
    const { state } = view
    const node = state.doc.nodeAt(nodePos)
    if (!node) return
    const nodeEnd = nodePos + node.nodeSize
    const tr = state.tr

    if (direction === 'up') {
      const prev = state.doc.resolve(nodePos).nodeBefore
      if (!prev) return
      const prevStart = nodePos - prev.nodeSize
      tr.delete(nodePos, nodeEnd).insert(prevStart, node)
      tr.setSelection(TextSelection.near(tr.doc.resolve(prevStart + 1)))
    } else {
      const next = state.doc.resolve(nodeEnd).nodeAfter
      if (!next) return
      tr.delete(nodePos, nodeEnd).insert(nodePos + next.nodeSize, node)
      tr.setSelection(TextSelection.near(tr.doc.resolve(nodePos + next.nodeSize + 1)))
    }
    view.dispatch(tr.scrollIntoView())
    view.focus()
  } catch (err) {
    console.warn('moveNode error:', err)
  }
}

function BlockMenu({ x, y, editor, nodePos, view, onClose }: {
  x: number, y: number, editor: TiptapEditor, nodePos: number, view: EditorView, onClose: () => void
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
        <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-gray-600 flex-shrink-0">
          <i className={`ti ${icon}`} style={{ fontSize: 15 }} />
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
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-2.5 pb-1">Déplacer</p>
      <Item icon="ti-arrow-up" label="Vers le haut" onClick={() => { moveNode(view, nodePos, 'up'); onClose() }} />
      <Item icon="ti-arrow-down" label="Vers le bas"  onClick={() => { moveNode(view, nodePos, 'down'); onClose() }} />
      <div className="border-t border-gray-100 my-1" />
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
          <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-gray-600 flex-shrink-0">
            <i className={`ti ${item.icon}`} style={{ fontSize: 15 }} />
          </span>
          <span className="text-sm text-gray-700">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

const BTN_SIZE = 24
// Le texte commence à 52px du bord gauche de la card.
// 28px d'offset = bouton visible, jamais en dehors de la card.
const BTN_OFFSET = 28

function DragButton({ view, editor }: { view: EditorView, editor: TiptapEditor }) {
  const [pos, setPos] = useState<{ top: number, left: number } | null>(null)
  const [menu, setMenu] = useState<{ x: number, y: number, nodePos: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentNodePosRef = useRef<number>(0)

  function clearHide() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }
  function scheduleHide() {
    clearHide()
    hideTimer.current = setTimeout(() => { if (!menu) setPos(null) }, 150)
  }

  useEffect(() => {
    // Écouté sur tout le document : ces boutons vivent dans une racine React
    // à part, où `onMouseEnter` ne part pas quand la souris arrive depuis
    // l'éditeur — la poignée disparaissait alors sous le pointeur.
    function onMouseMove(e: MouseEvent) {
      if (menu) return
      const target = e.target as HTMLElement | null
      if (!target?.closest) return
      if (target.closest('[data-drag-ctl]')) { clearHide(); return }
      const pmNode = target.closest('.ProseMirror > *') as HTMLElement | null
      if (!pmNode || !view.dom.contains(pmNode)) { scheduleHide(); return }
      clearHide()
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
      const top = rect.top + (lineH / 2) - (BTN_SIZE / 2)
      // Positionne le bouton à gauche du texte, avec un offset suffisant
      const left = rect.left - BTN_OFFSET
      setPos({ top, left })
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
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

  // Ajoute un paragraphe vide juste après le bloc survolé.
  function insertAfter() {
    try {
      const nodePos = currentNodePosRef.current
      const node = view.state.doc.nodeAt(nodePos)
      if (!node) return
      editor.chain().focus().insertContentAt(nodePos + node.nodeSize, { type: 'paragraph' }).run()
    } catch (err) { console.warn('insertAfter:', err) }
    setPos(null)
  }

  if (!pos) return null

  const btnStyle = {
    position: 'fixed' as const,
    left: pos.left,
    width: BTN_SIZE,
    height: BTN_SIZE,
    fontSize: 16,
    zIndex: 100,
    pointerEvents: 'auto' as const,
    cursor: 'pointer',
  }
  const btnClass = 'flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors select-none'

  return (
    <>
      <button
        ref={btnRef}
        data-drag-ctl
        onMouseDown={e => e.preventDefault()}
        onClick={handleClick}
        style={{ ...btnStyle, top: pos.top }}
        className={btnClass}
        title="Cliquer pour déplacer ou convertir"
      ><i className="ti ti-grip-vertical" /></button>
      {/* « + » d'ajout de bloc : juste sous la poignée, même bouton, même
          colonne — il ne recouvre jamais le texte. */}
      {!menu && (
        <button
          data-drag-ctl
          onMouseDown={e => e.preventDefault()}
          onClick={insertAfter}
          style={{ ...btnStyle, top: pos.top + BTN_SIZE }}
          className={btnClass}
          title="Ajouter un bloc après"
        ><i className="ti ti-plus" /></button>
      )}
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
        container.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:100;'
        document.body.appendChild(container)
        const root = createRoot(container)
        root.render(<DragButton view={editorView} editor={editor} />)
        return { destroy() { root.unmount(); container.remove() } }
      }
    })]
  }
})
