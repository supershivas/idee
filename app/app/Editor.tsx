'use client'
import { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Plugin } from '@tiptap/pm/state'
import { SlashCommands } from './SlashCommands'
import { Page } from './App'
import { createClient } from '@/lib/supabase/client'

// --- NOVEAUX IMPORTS POUR LES TABLEAUX ---
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'

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

async function uploadFileToSupabase(file: File, userId: string): Promise<string | null> {
  try {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    
    const { error } = await supabase.storage.from('images').upload(path, file)
    if (error) throw error

    const { data } = supabase.storage.from('images').getPublicUrl(path)
    return data.publicUrl
  } catch (error) {
    console.error("Erreur lors de l'upload Supabase:", error)
    return null
  }
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
      
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            class: { default: 'max-w-full rounded-lg my-2' }
          }
        },
        addProseMirrorPlugins() {
          return [
            new Plugin({
              props: {
                handlePaste(view, event) {
                  const items = Array.from(event.clipboardData?.items || [])
                  for (const item of items) {
                    if (item.type.indexOf('image') === 0) {
                      event.preventDefault()
                      const file = item.getAsFile()
                      if (file) {
                        setUploading(true)
                        uploadFileToSupabase(file, userId).then((url) => {
                          if (url) {
                            const node = view.state.schema.nodes.image.create({ src: url })
                            const transaction = view.state.tr.replaceSelectionWith(node)
                            view.dispatch(transaction)
                          }
                          setUploading(false)
                        })
                      }
                      return true
                    }
                  }
                  return false
                },
                handleDrop(view, event) {
                  const files = Array.from(event.dataTransfer?.files || [])
                  const images = files.filter(file => /image/i.test(file.type))
                  if (images.length > 0) {
                    event.preventDefault()
                    const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
                    images.forEach((file) => {
                      setUploading(true)
                      uploadFileToSupabase(file, userId).then((url) => {
                        if (url && coordinates) {
                          const node = view.state.schema.nodes.image.create({ src: url })
                          const transaction = view.state.tr.insert(coordinates.pos, node)
                          view.dispatch(transaction)
                        }
                        setUploading(false)
                      })
                    })
                    return true
                  }
                  return false
                }
              }
            })
          ]
        }
      }),

      // --- CONFIGURATION DES EXTENSIONS DE TABLEAUX ---
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'border-collapse table-auto w-full my-4 text-sm border border-gray-200' },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: { class: 'border border-gray-200 p-2 relative min-w-[100px] text-left align-top' },
      }),

      SlashCommands.configure({ onAddSubpage, pages, onUploadImage: () => fileInputRef.current?.click() }),
    ],
    content: page.content || '',
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  })

  useEffect(() => {
    if (editor) editor.commands.setContent(page.content || '')
  }, [page.id])

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
      const url = await uploadFileToSupabase(file, userId)
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
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

      <div className="editor-toolbar flex gap-0.5 px-4 md:px-8 py-2 border-t border-b border-gray-100 bg-gray-50/50 flex-nowrap overflow-x-auto">
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
        
        {/* --- DYNAMISME DES BOUTONS DE TABLEAUX --- */}
        <div className="w-px bg-gray-200 mx-1" />
        {!editor?.isActive('table') ? (
          <ToolBtn 
            onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} 
            active={false} 
            label="📊 +Tab" 
            title="Créer un tableau (3x3)" 
          />
        ) : (
          <>
            <ToolBtn onClick={() => editor?.chain().focus().addColumnAfter().run()} active={false} label="+👉 col" title="Ajouter une colonne" />
            <ToolBtn onClick={() => editor?.chain().focus().addRowAfter().run()} active={false} label="+👇 lig" title="Ajouter une ligne" />
            <ToolBtn onClick={() => editor?.chain().focus().deleteTable().run()} active={false} label="🗑️ Tab" title="Supprimer le tableau" />
          </>
        )}

        <div className="w-px bg-gray-200 mx-1" />
        <ToolBtn onClick={onAddSubpage} active={false} label="+ Sous-page" title="Créer une sous-page" />
      </div>

      <EditorContent editor={editor} className="flex-1 overflow-y-auto px-4 md:px-8 py-5 prose max-w-none" />
    </div>
  )
}
