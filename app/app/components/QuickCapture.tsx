'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function QuickCapture({ onSave, onClose }: {
  onSave: (title: string, content: string) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save() {
    if (!title.trim() && !content.trim()) { onClose(); return }
    setSaving(true)
    await onSave(title || 'Note rapide', content)
    setSaving(false)
    onClose()
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh] px-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-4 pt-4">
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
            placeholder="Titre de la note…"
            className="w-full text-base font-semibold outline-none bg-transparent"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <div className="px-4 pt-2 pb-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Contenu (optionnel)…"
            rows={4}
            className="w-full text-sm outline-none bg-transparent resize-none"
            style={{ color: 'var(--text-secondary)' }}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>⌘⇧C · Echap pour fermer</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg"
              style={{ color: 'var(--text-muted)' }}>Annuler</button>
            <button onClick={save} disabled={saving}
              className="px-3 py-1.5 text-sm rounded-lg font-medium disabled:opacity-50"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
              {saving ? '…' : 'Capturer'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
