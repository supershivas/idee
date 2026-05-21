'use client'
import { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { SlashCommands } from './SlashCommands'
import { Page } from './App'
import { createClient } from '@/lib/supabase/client'

function ToolBtn({ onClick, active, label, title }: { onClick: () => void, active?: boolean, label: string, title: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${active ? 'bg-gray-800 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
      {label}
    </button>
  )
}

function LinkModal({ onConfirm, onClose }: { onConfirm: (url: string) => void, onClose: () => void }) {
  const [url, setUrl] = useState('https://')
  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-80" onClick={e => e.stopPropagation()}>
        <p className="font-medium text-gray-800 mb-3">Insérer un lien</p>
        <input
          autoFocus
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(url) }}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300 mb-3"
          placeholder="https://..."
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Annuler</button>
          <button onClick={() => onConfirm(url)} className="px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800">Insérer</button>
        </div>
      </div>
    </div>
  )
}

export default function Editor({ page, pages, onUpdate, onAddSubpage, onNavigate, userId }: {
  page: Page, pages: Page[], onUpdate: (content: string) => void
  onAddSubpage: () => void, onNavigate: (page: Page) => void, userId: string
}) {
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Écris quelque chose ou tape / pour les commandes...' }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer hover:text-blue-800' } }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg my-2' } }),
      SlashCommands.configure({ onAddSubpage, pages, onUploadImage: () => fileInputRef.current?.click() }),
    ],
    content: page.content || '',
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  })

  useEffect(() => {
    if (editor) editor.commands.setContent(page.content || '')
  }, [page.id])

  // Clics sur liens internes
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

  function insertLink(url: string) {
    setShowLinkModal(false)
    if (!url || url === 'https://') return
    editor?.chain().focus().setLink({ href: url }).run()
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${userId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('images').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('images').getPublicUrl(path)
        editor.chain().focus().setImage({ src: data.publicUrl }).run()
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {showLinkModal && <LinkModal onConfirm={insertLink} onClose={() => setShowLinkModal(false)} />}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

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
        <ToolBtn onClick={() => setShowLinkModal(true)} active={editor?.isActive('link')} label="🔗" title="Lien externe" />
        <ToolBtn onClick={() => fileInputRef.current?.click()} active={false} label={uploading ? '⏳' : '🖼️'} title="Insérer une image" />
        <div className="w-px bg-gray-200 mx-1" />
        <ToolBtn onClick={onAddSubpage} active={false} label="+ Sous-page" title="Créer une sous-page" />
      </div>

      <EditorContent editor={editor} className="flex-1 overflow-y-auto px-8 py-5 prose max-w-none" />
    </div>
  )
}
