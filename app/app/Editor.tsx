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
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${active ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-700'}`}
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
      SlashCommands.configure({
        onAddSubpage,
      }),
    ],
    content: page.content || '',
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor) {
      editor.commands.setContent(page.content || '')
    }
  }, [page.id])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex gap-1 px-6 py-2 border-b flex-wrap border-t">
        <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label="G" title="Gras" />
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
        <ToolBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} label="<>" title="Code" />
        <div className="w-px bg-gray-200 mx-1" />
        <ToolBtn onClick={onAddSubpage} active={false} label="+ Sous-page" title="Créer une sous-page" />
      </div>
      <EditorContent editor={editor} className="flex-1 overflow-y-auto px-6 py-4 prose max-w-none" />
    </div>
  )
}
