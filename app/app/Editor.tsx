'use client'
import { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TableRow from '@tiptap/extension-table-row'
import { Plugin } from '@tiptap/pm/state'
import { SlashCommands } from './SlashCommands'
import { DragHandleExtension } from './DragHandle'
import { Page } from './types'
import { useKeyboardOffset } from './hooks'
import { createClient } from '@/lib/supabase/client'

function ToolBtn({ onClick, active, label, title }: { onClick: () => void, active?: boolean, label: string, title: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`flex items-center justify-center rounded text-sm font-medium transition-colors flex-shrink-0
        ${active ? 'bg-gray-800 text-white' : 'hover:bg-gray-100 active:bg-gray-200 text-gray-600'}`}
      style={{ minWidth: '36px', minHeight: '40px', padding: '0 8px' }}>
      {label}
    </button>
  )
}

function LinkModal({ onConfirm, onClose }: { onConfirm: (url: string) => void, onClose: () => void }) {
  const [url, setUrl] = useState('https://')
  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-xl shadow-xl p-5 w-full md:w-80" onClick={e => e.stopPropagation()}>
        <p className="font-medium text-gray-800 mb-3">Insérer un lien</p>
        <input autoFocus value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(url) }}
          className="w-full border rounded-lg px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300 mb-3"
          placeholder="https://..." />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500">Annuler</button>
          <button onClick={() => onConfirm(url)} className="px-4 py-2.5 text-sm bg-black text-white rounded-lg">Insérer</button>
        </div>
      </div>
    </div>
  )
}

function TableBottomSheet({ editor, onClose }: { editor: any, onClose: () => void }) {
  const actions = [
    { label: '← Colonne avant', fn: () => editor.chain().focus().addColumnBefore().run() },
    { label: 'Colonne après →', fn: () => editor.chain().focus().addColumnAfter().run() },
    { label: '↑ Ligne avant', fn: () => editor.chain().focus().addRowBefore().run() },
    { label: 'Ligne après ↓', fn: () => editor.chain().focus().addRowAfter().run() },
    { label: '− Supprimer colonne', fn: () => editor.chain().focus().deleteColumn().run(), danger: true },
    { label: '− Supprimer ligne', fn: () => editor.chain().focus().deleteRow().run(), danger: true },
    { label: '🗑 Supprimer tableau', fn: () => editor.chain().focus().deleteTable().run(), danger: true },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4" />
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-5 mb-2">Tableau</p>
        {actions.map((a, i) => (
          <button key={i} onClick={() => { a.fn(); onClose() }}
            className={`w-full text-left px-5 py-4 text-base border-t border-gray-100 ${a.danger ? 'text-red-500 active:bg-red-50' : 'text-gray-800 active:bg-gray-100'}`}>
            {a.label}
          </button>
        ))}
        <button onClick={onClose} className="w-full text-center py-4 text-sm text-gray-400 border-t border-gray-100">Annuler</button>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
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
    console.error('Erreur upload:', error)
    return null
  }
}

export default function Editor({ page, pages, onUpdate, onAddSubpage, onNavigate, userId, isMobile }: {
  page: Page, pages: Page[], onUpdate: (content: string) => void
  onAddSubpage: () => void, onNavigate: (page: Page) => void, userId: string, isMobile: boolean
}) {
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showTableSheet, setShowTableSheet] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fix clavier iOS : décale la toolbar au-dessus du clavier via visualViewport
  const keyboardOffset = useKeyboardOffset()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Écris quelque chose ou tape / pour les commandes...' }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer hover:text-blue-800' } }),
      Table.configure({ resizable: !isMobile }),
      TableHeader, TableCell, TableRow,
      Image.extend({
        addAttributes() { return { ...this.parent?.(), class: { default: 'max-w-full rounded-lg my-2' } } },
        addProseMirrorPlugins() {
          return [new Plugin({
            props: {
              handlePaste(view, event) {
                const items = Array.from(event.clipboardData?.items || [])
                for (const item of items) {
                  if (item.type.indexOf('image') === 0) {
                    event.preventDefault()
                    const file = item.getAsFile()
                    if (file) {
                      setUploading(true)
                      uploadFileToSupabase(file, userId).then(url => {
                        if (url) view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src: url })))
                        setUploading(false)
                      })
                    }
                    return true
                  }
                }
                return false
              },
              handleDrop(view, event) {
                const images = Array.from(event.dataTransfer?.files || []).filter(f => /image/i.test(f.type))
                if (!images.length) return false
                event.preventDefault()
                const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
                images.forEach(file => {
                  setUploading(true)
                  uploadFileToSupabase(file, userId).then(url => {
                    if (url && coords) view.dispatch(view.state.tr.insert(coords.pos, view.state.schema.nodes.image.create({ src: url })))
                    setUploading(false)
                  })
                })
                return true
              }
            }
          })]
        }
      }),
      SlashCommands.configure({ onAddSubpage, pages, onUploadImage: () => fileInputRef.current?.click() }),
      ...(!isMobile ? [DragHandleExtension] : []),
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
        const linked = pages.find(p => p.id === target.getAttribute('data-page-id'))
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
      if (url) editor.chain().focus().setImage({ src: url }).run()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const Sep = () => <div className="w-px bg-gray-200 mx-0.5 self-stretch flex-shrink-0" />

  const toolbarMobile = (
    <>
      <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label="B" title="Gras" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label="I" title="Italique" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} label="H1" title="Titre 1" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} label="H2" title="Titre 2" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} label="•" title="Liste" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} label="1." title="Numérotée" />
      <Sep />
      <ToolBtn onClick={() => setShowLinkModal(true)} active={editor?.isActive('link')} label="🔗" title="Lien" />
      <ToolBtn onClick={() => fileInputRef.current?.click()} active={false} label={uploading ? '⏳' : '🖼️'} title="Image" />
      <Sep />
      <ToolBtn
        onClick={() => editor?.isActive('table') ? setShowTableSheet(true) : editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        active={editor?.isActive('table')} label="⊞" title="Tableau" />
      <ToolBtn onClick={onAddSubpage} active={false} label="＋" title="Sous-page" />
    </>
  )

  const toolbarDesktop = (
    <>
      <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label="B" title="Gras" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label="I" title="Italique" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} label="S̶" title="Barré" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} label="H1" title="Titre 1" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} label="H2" title="Titre 2" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} label="• Liste" title="Liste à puces" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} label="1. Liste" title="Numérotée" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} label="❝" title="Citation" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} label="</>" title="Code" />
      <Sep />
      <ToolBtn onClick={() => setShowLinkModal(true)} active={editor?.isActive('link')} label="🔗" title="Lien externe" />
      <ToolBtn onClick={() => fileInputRef.current?.click()} active={false} label={uploading ? '⏳' : '🖼️'} title="Image" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={editor?.isActive('table')} label="⊞ Tableau" title="Tableau 3×3" />
      <Sep />
      <ToolBtn onClick={onAddSubpage} active={false} label="+ Sous-page" title="Créer une sous-page" />
    </>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {showLinkModal && <LinkModal onConfirm={insertLink} onClose={() => setShowLinkModal(false)} />}
      {showTableSheet && isMobile && <TableBottomSheet editor={editor} onClose={() => setShowTableSheet(false)} />}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* BubbleMenu tableau — desktop uniquement */}
      {editor && !isMobile && (
        <BubbleMenu editor={editor} shouldShow={({ editor }) => editor.isActive('table')} tippyOptions={{ placement: 'top', offset: [0, 8] }}>
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-xl shadow-lg px-2 py-1.5">
            <span className="text-xs text-gray-400 mr-1 font-medium">Tableau</span>
            <div className="w-px bg-gray-200 self-stretch mx-1" />
            <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-600">← Col</button>
            <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-600">Col →</button>
            <button onClick={() => editor.chain().focus().addRowBefore().run()} className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-600">↑ Ligne</button>
            <button onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-600">Ligne ↓</button>
            <div className="w-px bg-gray-200 self-stretch mx-1" />
            <button onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-1 text-xs rounded hover:bg-red-50 text-red-400">− Col</button>
            <button onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-1 text-xs rounded hover:bg-red-50 text-red-400">− Ligne</button>
            <div className="w-px bg-gray-200 self-stretch mx-1" />
            <button onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-1 text-xs rounded hover:bg-red-50 text-red-500">🗑</button>
          </div>
        </BubbleMenu>
      )}

      {/* Zone d'édition */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="prose max-w-none py-6 px-4 md:px-8 md:py-8" style={{ maxWidth: '720px' }} />
      </div>

      {/* Toolbar — sticky, remonte au-dessus du clavier iOS via keyboardOffset */}
      <div
        className="editor-toolbar flex items-center gap-0.5 px-2 border-t border-gray-100 bg-white flex-nowrap overflow-x-auto"
        style={{
          minHeight: '48px',
          position: 'sticky',
          bottom: isMobile ? keyboardOffset : 0,
          zIndex: 10,
          transition: 'bottom 0.2s ease',
        }}
      >
        {isMobile ? toolbarMobile : toolbarDesktop}
      </div>

      <style>{`
        .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 1rem 0; }
        .ProseMirror table td, .ProseMirror table th { min-width: 2em; border: 1px solid #d1d5db; padding: 6px 10px; vertical-align: top; box-sizing: border-box; position: relative; font-size: 0.9em; }
        .ProseMirror table th { background-color: #f9fafb; font-weight: 600; text-align: left; }
        .ProseMirror table tr:hover td { background-color: #fafafa; }
        .ProseMirror table .selectedCell:after { z-index: 2; position: absolute; content: ""; left: 0; right: 0; top: 0; bottom: 0; background: rgba(59,130,246,0.08); pointer-events: none; }
        .ProseMirror table .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: 0; width: 4px; background-color: #3b82f6; cursor: col-resize; z-index: 20; }
        .ProseMirror .tableWrapper { overflow-x: auto; margin: 1rem 0; }
        .resize-cursor { cursor: col-resize; }
        .ProseMirror img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5rem 0; display: block; }
        .ProseMirror p.is-editor-empty:first-child::before { color: #adb5bd; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
        @media (max-width: 767px) { .ProseMirror { font-size: 16px; line-height: 1.7; } .ProseMirror p { margin: 0.6em 0; } }
      `}</style>
    </div>
  )
}
