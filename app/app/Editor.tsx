'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TableRow from '@tiptap/extension-table-row'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Plugin } from '@tiptap/pm/state'
import { SlashCommands } from './SlashCommands'
import { DragHandleExtension } from './DragHandle'
import { createSubpageExtension, insertSubpageBlock } from './SubpageNode'
import { Backlinks } from './Backlinks'
import { Page } from './types'
import { useKeyboardOffset } from './hooks'
import { createClient } from '@/lib/supabase/client'

function ToolBtn({ onClick, active, label, title }: { onClick: () => void, active?: boolean, label: string, title: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`toolbar-btn flex items-center justify-center rounded text-sm font-medium transition-colors flex-shrink-0
        ${active ? 'is-active' : ''}`}
      style={{ minWidth: '36px', minHeight: '40px', padding: '0 8px' }}>
      {label}
    </button>
  )
}

function LinkModal({ onConfirm, onClose }: { onConfirm: (url: string) => void, onClose: () => void }) {
  const [url, setUrl] = useState('https://')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="rounded-t-2xl md:rounded-xl shadow-xl p-5 w-full md:w-80"
        style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}
        onClick={e => e.stopPropagation()}>
        <p className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Insérer un lien</p>
        <input autoFocus value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(url) }}
          className="w-full rounded-lg px-3 py-3 text-sm outline-none mb-3"
          style={{ border: '1px solid var(--border)', background: 'var(--app-bg)', color: 'var(--text-primary)' }}
          placeholder="https://..." />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>Annuler</button>
          <button onClick={() => onConfirm(url)}
            className="px-4 py-2.5 text-sm rounded-lg"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
            Insérer
          </button>
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
      <div className="w-full rounded-t-2xl shadow-2xl" style={{ background: 'var(--card-bg)' }} onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-4" style={{ background: 'var(--border)' }} />
        <p className="text-xs font-medium uppercase tracking-wide px-5 mb-2" style={{ color: 'var(--text-muted)' }}>Tableau</p>
        {actions.map((a, i) => (
          <button key={i} onClick={() => { a.fn(); onClose() }}
            className={`w-full text-left px-5 py-4 text-base transition-colors`}
            style={{ borderTop: '1px solid var(--border-light)', color: a.danger ? '#f87171' : 'var(--text-primary)' }}>
            {a.label}
          </button>
        ))}
        <button onClick={onClose} className="w-full text-center py-4 text-sm" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>Annuler</button>
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
  const keyboardOffset = useKeyboardOffset()

  const subpageExtension = useMemo(
    () => createSubpageExtension(pages, onNavigate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages.map(p => p.id + p.title + p.icon).join(',')]
  )

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      Placeholder.configure({ placeholder: 'Écris quelque chose ou tape / pour les commandes...' }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: null },
        protocols: ['https', 'http', '#'],
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            'data-page-id': { default: null },
            class: { default: null },
          }
        },
      }),
      Table.configure({ resizable: !isMobile }),
      TableHeader, TableCell, TableRow,
      subpageExtension,
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
      SlashCommands.configure({
        onAddSubpage,
        pages,
        onUploadImage: () => fileInputRef.current?.click(),
        onInsertSubpage: (pageId: string) => {
          if (editor) insertSubpageBlock(editor, pageId)
        },
      }),
      ...(!isMobile ? [DragHandleExtension] : []),
    ],
    content: page.content || '',
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && editor.getHTML() !== (page.content || '')) {
      editor.commands.setContent(page.content || '', false)
    }
  }, [page.id])

  function insertLink(url: string) {
    setShowLinkModal(false)
    if (!url || url === 'https://') return
    editor?.chain().focus().setLink({ href: url }).run()
  }

  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom

    function handleNav(target: HTMLElement) {
      const link = target.closest('[data-page-id]') as HTMLElement | null
      if (!link) return
      const pageId = link.getAttribute('data-page-id')
      const linked = pages.find(p => p.id === pageId)
      if (linked) onNavigate(linked)
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-page-id]')) {
        e.preventDefault()
        handleNav(target)
        return
      }
      const anchor = target.closest('a') as HTMLAnchorElement | null
      if (anchor?.href && !anchor.getAttribute('data-page-id')) {
        e.preventDefault()
        window.open(anchor.href, '_blank', 'noopener,noreferrer')
      }
    }

    function onTouchEnd(e: TouchEvent) {
      handleNav(e.target as HTMLElement)
    }

    el.addEventListener('click', onClick)
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('click', onClick)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [editor, pages, onNavigate])

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

  const Sep = () => <div className="w-px self-stretch flex-shrink-0 mx-0.5" style={{ background: 'var(--border)' }} />

  const toolbarMobile = (
    <>
      <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label="B" title="Gras" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label="I" title="Italique" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} label="U̲" title="Souligné" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} label="S̶" title="Barré" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} label="H1" title="Titre 1" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} label="H2" title="Titre 2" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} label="•" title="Liste" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} label="1." title="Numérotée" />
      <ToolBtn onClick={() => (editor?.chain().focus() as any).toggleTaskList().run()} active={editor?.isActive('taskList')} label="☑" title="Cases à cocher" />
      <Sep />
      <ToolBtn onClick={() => setShowLinkModal(true)} active={editor?.isActive('link')} label="🔗" title="Lien" />
      <ToolBtn onClick={() => fileInputRef.current?.click()} active={false} label={uploading ? '⏳' : '🖼️'} title="Image" />
      <Sep />
      <ToolBtn
        onClick={() => editor?.isActive('table') ? setShowTableSheet(true) : editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        active={editor?.isActive('table')} label="⊞" title="Tableau" />
    </>
  )

  const toolbarDesktop = (
    <>
      <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label="B" title="Gras" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label="I" title="Italique" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} label="U̲" title="Souligné" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} label="S̶" title="Barré" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} label="H1" title="Titre 1" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} label="H2" title="Titre 2" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} label="• Liste" title="Liste à puces" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} label="1. Liste" title="Numérotée" />
      <ToolBtn onClick={() => (editor?.chain().focus() as any).toggleTaskList().run()} active={editor?.isActive('taskList')} label="☑ Cases" title="Cases à cocher" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} label="❝" title="Citation" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} label="</>" title="Code" />
      <Sep />
      <ToolBtn onClick={() => setShowLinkModal(true)} active={editor?.isActive('link')} label="🔗" title="Lien externe" />
      <ToolBtn onClick={() => fileInputRef.current?.click()} active={false} label={uploading ? '⏳' : '🖼️'} title="Image" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={editor?.isActive('table')} label="⊞ Tableau" title="Tableau 3×3" />
    </>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {showLinkModal && <LinkModal onConfirm={insertLink} onClose={() => setShowLinkModal(false)} />}
      {showTableSheet && isMobile && <TableBottomSheet editor={editor} onClose={() => setShowTableSheet(false)} />}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* BubbleMenu sélection de texte */}
      {editor && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor, state }) => {
            const { selection } = state
            const { empty } = selection
            return !empty && !editor.isActive('table')
          }}
          tippyOptions={{ placement: 'top', offset: [0, 8], animation: 'fade' }}
        >
          <div className="flex items-center gap-0.5 rounded-xl shadow-xl px-1.5 py-1.5" style={{ background: '#1a1a1a' }}>
            <button onClick={() => editor.chain().focus().toggleBold().run()}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-white text-gray-900' : 'text-white hover:bg-white/10'}`}>B</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`px-2 py-1 text-xs italic rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-white text-gray-900' : 'text-white hover:bg-white/10'}`}>I</button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${editor.isActive('underline') ? 'bg-white text-gray-900' : 'text-white hover:bg-white/10'}`}
              style={{ textDecoration: 'underline' }}>U</button>
            <button onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${editor.isActive('strike') ? 'bg-white text-gray-900' : 'text-white hover:bg-white/10'}`}><s>S</s></button>
            <button onClick={() => editor.chain().focus().toggleCode().run()}
              className={`px-2 py-1 text-xs font-mono rounded-lg transition-colors ${editor.isActive('code') ? 'bg-white text-gray-900' : 'text-white hover:bg-white/10'}`}>`·`</button>
            <div className="w-px bg-white/20 self-stretch mx-0.5" />
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-white text-gray-900' : 'text-white hover:bg-white/10'}`}>H1</button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-white text-gray-900' : 'text-white hover:bg-white/10'}`}>H2</button>
            <div className="w-px bg-white/20 self-stretch mx-0.5" />
            <button
              onClick={() => {
                if (editor.isActive('link')) {
                  editor.chain().focus().unsetLink().run()
                } else {
                  const url = window.prompt('URL du lien :')
                  if (url) editor.chain().focus().setLink({ href: url }).run()
                }
              }}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${editor.isActive('link') ? 'bg-white text-gray-900' : 'text-white hover:bg-white/10'}`}
              title={editor.isActive('link') ? 'Retirer le lien' : 'Ajouter un lien'}
            >🔗</button>
          </div>
        </BubbleMenu>
      )}

      {/* BubbleMenu tableau desktop */}
      {editor && !isMobile && (
        <BubbleMenu editor={editor} shouldShow={({ editor }) => editor.isActive('table')} tippyOptions={{ placement: 'top', offset: [0, 8] }}>
          <div className="flex items-center gap-0.5 rounded-xl shadow-lg px-2 py-1.5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <span className="text-xs mr-1 font-medium" style={{ color: 'var(--text-muted)' }}>Tableau</span>
            <div className="w-px self-stretch mx-1" style={{ background: 'var(--border)' }} />
            {[
              { label: '← Col', fn: () => editor.chain().focus().addColumnBefore().run() },
              { label: 'Col →', fn: () => editor.chain().focus().addColumnAfter().run() },
              { label: '↑ Ligne', fn: () => editor.chain().focus().addRowBefore().run() },
              { label: 'Ligne ↓', fn: () => editor.chain().focus().addRowAfter().run() },
            ].map((a, i) => (
              <button key={i} onClick={a.fn}
                className="px-2 py-1 text-xs rounded transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {a.label}
              </button>
            ))}
            <div className="w-px self-stretch mx-1" style={{ background: 'var(--border)' }} />
            {[
              { label: '− Col', fn: () => editor.chain().focus().deleteColumn().run() },
              { label: '− Ligne', fn: () => editor.chain().focus().deleteRow().run() },
            ].map((a, i) => (
              <button key={i} onClick={a.fn}
                className="px-2 py-1 text-xs rounded transition-colors text-red-400"
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {a.label}
              </button>
            ))}
            <div className="w-px self-stretch mx-1" style={{ background: 'var(--border)' }} />
            <button onClick={() => editor.chain().focus().deleteTable().run()}
              className="px-2 py-1 text-xs rounded transition-colors text-red-500"
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>🗑</button>
          </div>
        </BubbleMenu>
      )}

      {/* Toolbar desktop */}
      {!isMobile && (
        <div className="editor-toolbar flex items-center gap-0.5 px-2 flex-nowrap overflow-x-auto flex-shrink-0"
          style={{ minHeight: '48px' }}>
          {toolbarDesktop}
        </div>
      )}

      {/* Zone d'édition + backlinks */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className="prose max-w-none py-6 md:py-6"
          style={{ paddingLeft: '52px', paddingRight: '24px' }}
        />
        <Backlinks currentPage={page} pages={pages} onNavigate={onNavigate} />
      </div>

      {/* Toolbar mobile sticky */}
      {isMobile && (
        <div className="editor-toolbar flex items-center gap-0.5 px-2 flex-nowrap overflow-x-auto"
          style={{ minHeight: '48px', position: 'sticky', bottom: keyboardOffset, zIndex: 10, transition: 'bottom 0.2s ease' }}>
          {toolbarMobile}
        </div>
      )}

      {/* Styles ProseMirror inline */}
      <style>{`
        .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 1rem 0; }
        .ProseMirror table td, .ProseMirror table th {
          min-width: 2em;
          border: 1px solid var(--prose-table-border);
          padding: 6px 10px; vertical-align: top;
          box-sizing: border-box; position: relative; font-size: 0.9em;
          color: var(--prose-color);
        }
        .ProseMirror table th { background-color: var(--prose-table-th); font-weight: 600; text-align: left; }
        .ProseMirror table tr:hover td { background-color: var(--prose-row-hover); }
        .ProseMirror table .selectedCell:after {
          z-index: 2; position: absolute; content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(96,165,250,0.1); pointer-events: none;
        }
        .ProseMirror table .column-resize-handle {
          position: absolute; right: -2px; top: 0; bottom: 0;
          width: 4px; background-color: var(--prose-link); cursor: col-resize; z-index: 20;
        }
        .ProseMirror .tableWrapper { overflow-x: auto; margin: 1rem 0; }
        .resize-cursor { cursor: col-resize; }
        .ProseMirror img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5rem 0; display: block; }
        .ProseMirror a { color: var(--prose-link); text-decoration: underline; cursor: pointer; }
        .ProseMirror a:hover { color: var(--prose-link-hover); }
        .ProseMirror a.page-link { color: var(--pagelink-fg); text-decoration: underline; cursor: pointer; font-weight: 500; }
        .ProseMirror a.page-link:hover { background: var(--pagelink-hover); border-radius: 3px; }
        /* Task list */
        .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.25rem; }
        .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
        .ProseMirror ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 0.2rem; cursor: pointer; }
        .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] { cursor: pointer; width: 1rem; height: 1rem; }
        .ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
        .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div { opacity: 0.6; text-decoration: line-through; }
        /* Drag handle spacing */
        .drag-handle { margin-left: -28px; padding-right: 8px; }
        @media (max-width: 767px) { .ProseMirror { font-size: 16px; line-height: 1.7; } .ProseMirror p { margin: 0.6em 0; } }
      `}</style>
    </div>
  )
}
