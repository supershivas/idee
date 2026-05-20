'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

type Note = {
  id: string
  title: string
  content: string
  updated_at: string
}

function Editor({ note, onUpdate }: { note: Note, onUpdate: (content: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Commence à écrire...' }),
    ],
    content: note.content || '',
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && note.content !== editor.getHTML()) {
      editor.commands.setContent(note.content || '')
    }
  }, [note.id])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex gap-1 px-6 py-2 border-b flex-wrap">
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
      </div>
      <EditorContent editor={editor} className="flex-1 overflow-y-auto px-6 py-4 prose max-w-none" />
    </div>
  )
}

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

export default function NotesList({ initialNotes, userId }: { initialNotes: Note[], userId: string }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [selected, setSelected] = useState<Note | null>(notes[0] || null)
  const [saving, setSaving] = useState(false)

  async function createNote() {
    const supabase = createClient()
    const { data } = await supabase
      .from('notes')
      .insert({ title: 'Sans titre', content: '', user_id: userId })
      .select()
      .single()
    if (data) {
      setNotes([data, ...notes])
      setSelected(data)
    }
  }

  async function updateTitle(value: string) {
    if (!selected) return
    const updated = { ...selected, title: value, updated_at: new Date().toISOString() }
    setSelected(updated)
    setNotes(notes.map(n => n.id === updated.id ? updated : n))
    setSaving(true)
    const supabase = createClient()
    await supabase.from('notes').update({ title: value, updated_at: updated.updated_at }).eq('id', selected.id)
    setSaving(false)
  }

  async function updateContent(content: string) {
    if (!selected) return
    const updated = { ...selected, content, updated_at: new Date().toISOString() }
    setSelected(prev => prev ? { ...prev, content } : null)
    setNotes(notes.map(n => n.id === updated.id ? updated : n))
    setSaving(true)
    const supabase = createClient()
    await supabase.from('notes').update({ content, updated_at: updated.updated_at }).eq('id', selected.id)
    setSaving(false)
  }

  async function deleteNote(id: string) {
    const supabase = createClient()
    await supabase.from('notes').delete().eq('id', id)
    const remaining = notes.filter(n => n.id !== id)
    setNotes(remaining)
    setSelected(remaining[0] || null)
  }

  return (
    <div className="flex w-full h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <span className="font-semibold">Idée</span>
          <button onClick={createNote} className="text-xl font-light hover:text-gray-500" title="Nouvelle note">+</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 && (
            <p className="text-sm text-gray-400 p-4">Aucune note. Clique sur + pour commencer.</p>
          )}
          {notes.map(note => (
            <div
              key={note.id}
              onClick={() => setSelected(note)}
              className={`px-4 py-3 cursor-pointer border-b hover:bg-gray-100 ${selected?.id === note.id ? 'bg-white border-l-2 border-l-black' : ''}`}
            >
              <p className="text-sm font-medium truncate">{note.title || 'Sans titre'}</p>
              <p className="text-xs text-gray-400">{new Date(note.updated_at).toLocaleDateString('fr-FR')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Éditeur */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <input
                className="text-xl font-semibold outline-none w-full"
                value={selected.title}
                onChange={e => updateTitle(e.target.value)}
                placeholder="Sans titre"
              />
              <div className="flex items-center gap-3 ml-4">
                {saving && <span className="text-xs text-gray-400">Sauvegarde...</span>}
                <button onClick={() => deleteNote(selected.id)} className="text-sm text-red-400 hover:text-red-600">Supprimer</button>
              </div>
            </div>
            <Editor key={selected.id} note={selected} onUpdate={updateContent} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>Sélectionne une note ou crée-en une nouvelle</p>
          </div>
        )}
      </div>
    </div>
  )
}
