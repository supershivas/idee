'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Note = {
  id: string
  title: string
  content: string
  updated_at: string
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

  async function updateNote(field: 'title' | 'content', value: string) {
    if (!selected) return
    const updated = { ...selected, [field]: value, updated_at: new Date().toISOString() }
    setSelected(updated)
    setNotes(notes.map(n => n.id === updated.id ? updated : n))
    setSaving(true)
    const supabase = createClient()
    await supabase.from('notes').update({ [field]: value, updated_at: updated.updated_at }).eq('id', selected.id)
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
          <button onClick={createNote} className="text-xl font-light hover:text-gray-500">+</button>
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
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <input
                className="text-xl font-semibold outline-none w-full"
                value={selected.title}
                onChange={e => updateNote('title', e.target.value)}
                placeholder="Sans titre"
              />
              <div className="flex items-center gap-3 ml-4">
                {saving && <span className="text-xs text-gray-400">Sauvegarde...</span>}
                <button onClick={() => deleteNote(selected.id)} className="text-sm text-red-400 hover:text-red-600">Supprimer</button>
              </div>
            </div>
            <textarea
              className="flex-1 p-6 outline-none resize-none text-gray-700"
              value={selected.content}
              onChange={e => updateNote('content', e.target.value)}
              placeholder="Commence à écrire..."
            />
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
