'use client'
import { Extension, ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'
import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react'
import 'tippy.js/dist/tippy.css'
import { Page } from './App'

// ─── Page picker (sous-menu lier une page) ───────────────────────────────────

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
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une page..."
          className="w-full text-sm outline-none px-2 py-1"
          onKeyDown={e => { if (e.key === 'Escape') props.onClose() }}
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-2">Aucune page trouvée</p>
        )}
        {filtered.map(page => (
          <button
            key={page.id}
            onClick={() => props.onSelect(page)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 text-sm"
          >
            <span>{page.icon || '📄'}</span>
            <span className="truncate">{page.title || 'Sans titre'}</span>
          </button>
        ))}
      </div>
    </div>
  )
})
PagePicker.displayName = 'PagePicker'

// ─── Commandes principales ────────────────────────────────────────────────────

const getCommands = (onAddSubpage: () => void, onLinkPage: () => void) => [
  { title: 'Nouvelle sous-page', description: 'Créer une page enfant', icon: '📄', action: (_editor) => onAddSubpage() },
  { title: 'Lier une page', description: 'Insérer un lien vers une page', icon: '🔗', action: (_editor) => onLinkPage() },
  { title: 'Titre 1', description: 'Grand titre', icon: 'H1', action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: 'Titre 2', description: 'Titre moyen', icon: 'H2', action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Titre 3', description: 'Petit titre', icon: 'H3', action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: 'Liste à puces', description: 'Liste simple', icon: '•', action: (editor) => editor.chain().focus().toggleBulletList().run() },
  { title: 'Liste numérotée', description: 'Liste avec numéros', icon: '1.', action: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { title: 'Citation', description: 'Bloc de citation', icon: '❝', action: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { title: 'Code', description: 'Bloc de code', icon: '<>', action: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { title: 'Séparateur', description: 'Ligne horizontale', icon: '—', action: (editor) => editor.chain().focus().setHorizontalRule().run() },
]

// ─── Liste des commandes ──────────────────────────────────────────────────────

const CommandList = forwardRef((props: any, ref) => {
  const [selected, setSelected] = useState(0)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null)
  const pick
