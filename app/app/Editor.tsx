'use client'
import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { SlashCommands } from './SlashCommands'
import { Page } from './App'

function ToolBtn({ onClick, active, label, title }: { onClick: () => void, active?: boolean, label: string, title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${active ? 'bg-gray-800 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
    >
      {label}
    </button>
  )
}

export default function Editor({ page, pages, onUpdate, onAddSubpage, onNavigate }: {
  page: Page
  pages: Page[]
  onUpdate: (content: string) => void
  onAddSubpage: () => void
  onNavigate: (page: Page) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Écris quelque chose ou tape / pour les commandes...' }),
      SlashCommands.configure({ onAddSubpage, pages }),
    ],
    content: page.content || '',
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  })

  useEffect(() => {
    if (editor) editor.commands.setContent(page.content || '')
  }, [page.id])

  // Gère les clics sur les liens de pages internes
  useEffect(() => {
    const el = document.querySelector('.ProseMirror')
    if (!el) return
    const handler = (e: Event) => {
      const target = (e.target as HTMLElement).closest('.page-link') as HTMLElement
      if (target) {
        e.preventDefault()
        const pageId = target.getAttribute('data-page-id')
        const linked = pages.find(p => p.id === pageId)
        if (linked) onNavigate(linked)
      }
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [pages, onNavigate])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex gap-0.5 px-8 py-2 border-t border-b border-gray-100 flex-wrap bg-gray-50/50">
        <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label="B" title="Gras" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label="I" title="Italique" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} label="S̶" title="Barré" />
        <div className="w-px bg-gray-200 mx-1" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} label="H1" title="Titre 1" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} label="H2" title="Titre 2" />
        <div className="w-px bg-gray-200 mx-1" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} label="• Liste" title="Liste à puces" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} label="1. Liste" title="Liste numérotée" />
        <div className="w-px bg-gray-200 mx-1" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} label="❝" title="Citation" />
        <ToolBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} label="</>" title="Code" />
        <div className="w-px bg-gray-200 mx-1" />
        <ToolBtn onClick={onAddSubpage} active={false} label="+ Sous-page" title="Créer une sous-page" />
      </div>
      <EditorContent editor={editor} className="flex-1 overflow-y-auto px-8 py-5 prose max-w-none" />
    </div>
  )
}
