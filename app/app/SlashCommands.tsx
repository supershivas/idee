'use client'
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react'
import 'tippy.js/dist/tippy.css'
import { Page } from './App'

const PagePicker = forwardRef((props: { pages: Page[], onSelect: (page: Page) => void, onClose: () => void }, ref) => {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const filtered = props.pages.filter(p =>
    (p.title || 'Sans titre').toLowerCase().includes(query.toLowerCase())
  )
  return (
    <div className="bg-white border rounded-lg shadow-xl overflow-hidden w-64 z-50">
      <div className="p-2 border-b">
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une page..."
          className="w-full text-sm outline-none px-2 py-1"
          onKeyDown={e => { if (e.key === 'Escape') props.onClose() }} />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">Aucune page trouvée</p>}
        {filtered.map(page => (
          <button key={page.id} onClick={() => props.onSelect(page)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 text-sm">
            <span>{page.icon || '📄'}</span>
            <span className="truncate text-gray-800">{page.title && page.title.trim() !== '' ? page.title : 'Sans titre'}</span>
          </button>
        ))}
      </div>
    </div>
  )
})
PagePicker.displayName = 'PagePicker'

const getCommands = (onAddSubpage: () => void, onUploadImage: () => void) => [
  { title: 'Nouvelle sous-page', description: 'Créer une page enfant', icon: '📄', action: () => onAddSubpage() },
  { title: 'Lier une page', description: 'Insérer un lien vers une page', icon: '🔗', action: () => {} },
  { title: 'Image', description: 'Uploader une image', icon: '🖼️', action: () => onUploadImage() },
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
  const [showPicker, setShowPicker] = useState(false)
  const commands = getCommands(props.onAddSubpage || (() => {}), props.onUploadImage || (() => {}))
  const filtered = commands.filter(c => c.title.toLowerCase().includes((props.query || '').toLowerCase()))

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (showPicker) return false
      if (event.key === 'ArrowUp') { setSelected(s => (s + filtered.length - 1) % filtered.length); return true }
      if (event.key === 'ArrowDown') { setSelected(s => (s + 1) % filtered.length); return true }
      if (event.key === 'Enter') { filtered[selected] && selectItem(selected); return true }
      return false
    },
  }))

  function selectItem(index: number) {
    const item = filtered[index]
    if (!item) return
    if (item.title === 'Lier une page') { setShowPicker(true); return }
    props.command(item)
  }

  function handlePageSelect(page: Page) {
    setShowPicker(false)
    props.command({
      action: (editor) => {
        editor.chain().focus().insertContent(
          `<a class="page-link" data-page-id="${page.id}" href="#${page.id}">${page.icon || '📄'} ${page.title || 'Sans titre'}</a> `
        ).run()
      },
      title: ''
    })
  }

  if (!filtered.length) return null

  return (
    <div className="relative">
      <div className="bg-white border rounded-lg shadow-xl overflow-hidden w-56 z-50">
        <div className="px-2 pt-2 pb-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-1">Commandes</p>
        </div>
        {filtered.map((item, index) => (
          <button id={`cmd-${index}`} key={item.title} onClick={() => selectItem(index)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${index === selected ? 'bg-gray-100' : ''}`}>
            <span className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded text-sm font-mono font-bold text-gray-600 flex-shrink-0">{item.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-400 truncate">{item.description}</p>
            </div>
          </button>
        ))}
      </div>
      {showPicker && (
        <div className="absolute left-full top-0 ml-2 z-50">
          <PagePicker pages={props.pages || []} onSelect={handlePageSelect} onClose={() => setShowPicker(false)} />
        </div>
      )}
    </div>
  )
})
CommandList.displayName = 'CommandList'

export const SlashCommands = Extension.create({
  name: 'slashCommands',
  addOptions() {
    return {
      onAddSubpage: () => {},
      onUploadImage: () => {},
      pages: [] as Page[],
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run()
          props.action(editor)
        },
      },
    }
  },
  addProseMirrorPlugins() {
    const { onAddSubpage, onUploadImage, pages } = this.options
    return [Suggestion({
      editor: this.editor,
      ...this.options.suggestion,
      render: () => {
        let component, popup
        return {
          onStart: props => {
            component = new ReactRenderer(CommandList, { props: { ...props, onAddSubpage, onUploadImage, pages }, editor: props.editor })
            popup = tippy('body', { getReferenceClientRect: props.clientRect, appendTo: () => document.body, content: component.element, showOnCreate: true, interactive: true, trigger: 'manual', placement: 'bottom-start' })
          },
          onUpdate: props => {
            component.updateProps({ ...props, onAddSubpage, onUploadImage, pages })
            popup[0].setProps({ getReferenceClientRect: props.clientRect })
          },
          onKeyDown: props => {
            if (props.event.key === 'Escape') { popup[0].hide(); return true }
            return component.ref?.onKeyDown(props)
          },
          onExit: () => { popup[0].destroy(); component.destroy() },
        }
      },
    })]
  },
})
