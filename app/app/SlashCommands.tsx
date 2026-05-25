'use client'
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react'
import 'tippy.js/dist/tippy.css'
import { Page } from './types'

// ─── PagePicker ───────────────────────────────────────────────────────────────
const PagePicker = forwardRef((props: { pages: Page[], onSelect: (page: Page) => void, onClose: () => void }, ref) => {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const filtered = props.pages.filter(p =>
    (p.title || 'Sans titre').toLowerCase().includes(query.toLowerCase())
  )
  return (
    <div className="bg-white border rounded-xl shadow-2xl overflow-hidden w-64 z-50">
      <div className="p-2 border-b">
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une page..."
          className="w-full text-sm outline-none px-2 py-1.5"
          onKeyDown={e => { if (e.key === 'Escape') props.onClose() }} />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">Aucune page trouvée</p>}
        {filtered.map(page => (
          <button key={page.id} onClick={() => props.onSelect(page)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0">
            <span>{page.icon || '📄'}</span>
            <span className="truncate text-gray-800">{page.title?.trim() || 'Sans titre'}</span>
          </button>
        ))}
      </div>
    </div>
  )
})
PagePicker.displayName = 'PagePicker'

// ─── Commandes ────────────────────────────────────────────────────────────────
type Command = {
  title: string
  description: string
  icon: string
  keywords?: string[]
  action: (editor: any) => void
}

const getCommands = (onAddSubpage: () => void, onUploadImage: () => void): Command[] => [
  {
    title: 'Texte', description: 'Paragraphe normal', icon: '¶', keywords: ['p', 'texte', 'paragraphe'],
    action: e => e.chain().focus().setParagraph().run()
  },
  {
    title: 'Titre 1', description: 'Grand titre', icon: 'H1', keywords: ['h1', 'titre', 'heading'],
    action: e => e.chain().focus().setHeading({ level: 1 }).run()
  },
  {
    title: 'Titre 2', description: 'Titre moyen', icon: 'H2', keywords: ['h2', 'titre', 'heading'],
    action: e => e.chain().focus().setHeading({ level: 2 }).run()
  },
  {
    title: 'Titre 3', description: 'Petit titre', icon: 'H3', keywords: ['h3', 'titre', 'heading'],
    action: e => e.chain().focus().setHeading({ level: 3 }).run()
  },
  {
    title: 'Liste à puces', description: 'Liste simple', icon: '•', keywords: ['liste', 'ul', 'bullet'],
    action: e => e.chain().focus().toggleBulletList().run()
  },
  {
    title: 'Liste numérotée', description: 'Liste avec numéros', icon: '1.', keywords: ['liste', 'ol', 'numéro'],
    action: e => e.chain().focus().toggleOrderedList().run()
  },
  {
    title: 'Citation', description: 'Bloc de citation', icon: '❝', keywords: ['quote', 'citation', 'blockquote'],
    action: e => e.chain().focus().toggleBlockquote().run()
  },
  {
    title: 'Code', description: 'Bloc de code', icon: '<>', keywords: ['code', 'pre'],
    action: e => e.chain().focus().toggleCodeBlock().run()
  },
  {
    title: 'Tableau', description: 'Insérer un tableau 3×3', icon: '⊞', keywords: ['table', 'tableau', 'grille'],
    action: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  },
  {
    title: 'Séparateur', description: 'Ligne horizontale', icon: '—', keywords: ['hr', 'divider', 'ligne'],
    action: e => e.chain().focus().setHorizontalRule().run()
  },
  {
    title: 'Image', description: 'Uploader une image', icon: '🖼️', keywords: ['image', 'photo', 'upload'],
    action: () => onUploadImage()
  },
  {
    title: 'Lien vers une page', description: 'Lien cliquable vers une page', icon: '🔗', keywords: ['lien', 'page', 'link'],
    action: () => {} // géré spécialement — ouvre PagePicker pour lien inline
  },
  {
    title: 'Bloc sous-page', description: 'Insérer une sous-page en bloc', icon: '📄', keywords: ['page', 'sous', 'bloc', 'embed'],
    action: () => {} // géré spécialement — ouvre PagePicker pour bloc subpage
  },
  {
    title: 'Nouvelle sous-page', description: 'Créer une page enfant', icon: '＋', keywords: ['page', 'nouveau', 'créer', 'enfant'],
    action: () => onAddSubpage()
  },
]

// ─── CommandList ──────────────────────────────────────────────────────────────
type Group = { label: string, commands: Command[] }

function groupCommands(filtered: Command[]): Group[] {
  const groups: Record<string, Command[]> = {
    'Texte': [],
    'Listes': [],
    'Blocs': [],
    'Médias': [],
    'Pages': [],
  }
  for (const cmd of filtered) {
    if (['Texte', 'Titre 1', 'Titre 2', 'Titre 3'].includes(cmd.title)) groups['Texte'].push(cmd)
    else if (['Liste à puces', 'Liste numérotée'].includes(cmd.title)) groups['Listes'].push(cmd)
    else if (['Citation', 'Code', 'Tableau', 'Séparateur'].includes(cmd.title)) groups['Blocs'].push(cmd)
    else if (['Image', 'Lien vers une page'].includes(cmd.title)) groups['Médias'].push(cmd)
    else groups['Pages'].push(cmd)
  }
  return Object.entries(groups).filter(([, cmds]) => cmds.length > 0).map(([label, commands]) => ({ label, commands }))
}

const CommandList = forwardRef((props: any, ref) => {
  const [selected, setSelected] = useState(0)
  const [showPicker, setShowPicker] = useState<'link' | 'subpage' | null>(null)
  const allCommands = getCommands(props.onAddSubpage || (() => {}), props.onUploadImage || (() => {}))
  const query = (props.query || '').toLowerCase()

  const filtered = allCommands.filter(c =>
    c.title.toLowerCase().includes(query) ||
    c.description.toLowerCase().includes(query) ||
    (c.keywords || []).some(k => k.includes(query))
  )
  const flatFiltered = filtered
  const groups = groupCommands(filtered)

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (showPicker) return false
      if (event.key === 'ArrowUp') { setSelected(s => (s + flatFiltered.length - 1) % flatFiltered.length); return true }
      if (event.key === 'ArrowDown') { setSelected(s => (s + 1) % flatFiltered.length); return true }
      if (event.key === 'Enter') { flatFiltered[selected] && selectItem(flatFiltered[selected]); return true }
      return false
    },
  }))

  function selectItem(item: Command) {
    if (item.title === 'Lien vers une page') { setShowPicker('link'); return }
    if (item.title === 'Bloc sous-page') { setShowPicker('subpage'); return }
    props.command(item)
  }

  function handlePageSelect(page: Page) {
    if (showPicker === 'subpage') {
      setShowPicker(null)
      props.command({
        title: '',
        action: (editor: any) => {
          editor.chain().focus().insertContent({
            type: 'subpage',
            attrs: { 'data-page-id': page.id },
          }).run()
        }
      })
    } else {
      // Lien inline vers une page
      setShowPicker(null)
      props.command({
        title: '',
        action: (editor: any) => {
          const text = `${page.icon || '📄'} ${page.title || 'Sans titre'}`
          const { from } = editor.state.selection
          editor
            .chain()
            .focus()
            .insertContentAt(from, {
              type: 'text',
              text,
              marks: [{
                type: 'link',
                attrs: {
                  href: `#${page.id}`,
                  class: 'page-link',
                  'data-page-id': page.id,
                  target: null,
                  rel: null,
                },
              }],
            })
            .run()
          // Déplace le curseur après le lien et sort du mark
          const newPos = editor.state.selection.from
          editor.chain().setTextSelection(newPos).unsetLink().insertContent(' ').run()
        }
      })
    }
  }

  if (!flatFiltered.length) return null

  let globalIndex = 0

  return (
    <div className="relative">
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden w-60 z-50 max-h-80 overflow-y-auto">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-2.5 pb-1">{group.label}</p>
            {group.commands.map(item => {
              const idx = globalIndex++
              const isSelected = idx === selected
              return (
                <button key={item.title}
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setSelected(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                  <span className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-mono font-bold text-gray-600 flex-shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 leading-tight">{item.title}</p>
                    <p className="text-xs text-gray-400 truncate">{item.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
        <div className="h-1" />
      </div>

      {showPicker && (
        <div className="absolute left-full top-0 ml-2 z-50">
          <PagePicker
            pages={props.pages || []}
            onSelect={handlePageSelect}
            onClose={() => setShowPicker(null)}
          />
        </div>
      )}
    </div>
  )
})
CommandList.displayName = 'CommandList'

// ─── Extension Tiptap ─────────────────────────────────────────────────────────
export const SlashCommands = Extension.create({
  name: 'slashCommands',
  addOptions() {
    return {
      onAddSubpage: () => {},
      onUploadImage: () => {},
      pages: [] as Page[],
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
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
        let component: any, popup: any
        return {
          onStart: (props: any) => {
            component = new ReactRenderer(CommandList, {
              props: { ...props, onAddSubpage, onUploadImage, pages },
              editor: props.editor,
            })
            popup = tippy('body', {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
              theme: 'light-border',
            })
          },
          onUpdate: (props: any) => {
            component.updateProps({ ...props, onAddSubpage, onUploadImage, pages })
            popup[0].setProps({ getReferenceClientRect: props.clientRect })
          },
          onKeyDown: (props: any) => {
            if (props.event.key === 'Escape') { popup[0].hide(); return true }
            return component.ref?.onKeyDown(props)
          },
          onExit: () => { popup[0].destroy(); component.destroy() },
        }
      },
    })]
  },
})
