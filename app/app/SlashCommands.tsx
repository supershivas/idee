'use client'
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { forwardRef, useImperativeHandle, useState } from 'react'
import 'tippy.js/dist/tippy.css'

const getCommands = (onAddSubpage: () => void) => [
  { title: 'Nouvelle sous-page', description: 'Créer une page enfant', icon: '📄', action: () => onAddSubpage() },
  { title: 'Titre 1', description: 'Grand titre', icon: 'H1', action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: 'Titre 2', description: 'Titre moyen', icon: 'H2', action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Titre 3', description: 'Petit titre', icon: 'H3', action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: 'Liste à puces', description: 'Liste simple', icon: '•', action: (editor) => editor.chain().focus().toggleBulletList().run() },
  { title: 'Liste numérotée', description: 'Liste avec numéros', icon: '1.', action: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { title: 'Citation', description: 'Bloc de citation', icon: '❝', action: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { title: 'Code', description: 'Bloc de code', icon: '<>', action: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { title: 'Séparateur', description: 'Ligne horizontale', icon: '—', action: (editor) => editor.chain().focus().setHorizontalRule().run() },
]

const CommandList = forwardRef((props: any, ref) => {
  const [selected, setSelected] = useState(0)
  const commands = getCommands(props.onAddSubpage || (() => {}))
  const filtered = commands.filter(c =>
    c.title.toLowerCase().includes(props.query.toLowerCase())
  )

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') { setSelected(s => (s + filtered.length - 1) % filtered.length); return true }
      if (event.key === 'ArrowDown') { setSelected(s => (s + 1) % filtered.length); return true }
      if (event.key === 'Enter') { filtered[selected] && selectItem(selected); return true }
      return false
    },
  }))

  function selectItem(index: number) {
    const item = filtered[index]
    if (item) props.command(item)
  }

  if (!filtered.length) return null

  return (
    <div className="bg-white border rounded-lg shadow-lg overflow-hidden w-56 z-50">
      {filtered.map((item, index) => (
        <button
          key={item.title}
          onClick={() => selectItem(index)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${index === selected ? 'bg-gray-100' : ''}`}
        >
          <span className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded text-sm font-mono font-bold text-gray-600">{item.icon}</span>
          <div>
            <p className="text-sm font-medium text-gray-800">{item.title}</p>
            <p className="text-xs text-gray-400">{item.description}</p>
          </div>
        </button>
      ))}
    </div>
  )
})

CommandList.displayName = 'CommandList'

export const SlashCommands = Extension.create({
  name: 'slashCommands',
  addOptions() {
    return {
      onAddSubpage: () => {},
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run()
          props.action(editor)
        }
      }
    }
  },
  addProseMirrorPlugins() {
    const onAddSubpage = this.options.onAddSubpage
    return [Suggestion({
      editor: this.editor,
      ...this.options.suggestion,
      render: () => {
        let component, popup
        return {
          onStart: props => {
            component = new ReactRenderer(CommandList, {
              props: { ...props, onAddSubpage },
              editor: props.editor
            })
            popup = tippy('body', {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            })
          },
          onUpdate: props => {
            component.updateProps({ ...props, onAddSubpage })
            popup[0].setProps({ getReferenceClientRect: props.clientRect })
          },
          onKeyDown: props => {
            if (props.event.key === 'Escape') { popup[0].hide(); return true }
            return component.ref?.onKeyDown(props)
          },
          onExit: () => { popup[0].destroy(); component.destroy() },
        }
      }
    })]
  },
})
