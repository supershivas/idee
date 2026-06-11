'use client'
import React, { useState, useRef } from 'react'
import { Page, formatSubtitle } from '../types'
import EmojiPicker from '../EmojiPicker'
import { TagsInput } from './TagsView'
import { useRelativeTime } from './JournalView'
import { ActionsMenu } from './ActionsMenu'
import HistoryButton from '../HistoryButton'
import ExportButton from '../ExportButton'
import ShareButton from '../ShareButton'
import { createClient } from '@/lib/supabase/client'
import { coverDataUri, coverSeeds } from '@/lib/coverGen'

function coverBackground(page: Page): string {
  const cv = page.cover_url
  if (!cv) return coverDataUri(page.id)
  if (cv.startsWith('svg:')) return coverDataUri(cv.slice(4))
  return cv
}

function CoverModal({ page, userId, onApply, onClose }: {
  page: Page
  userId: string
  onApply: (value: string | null) => Promise<void>
  onClose: () => void
}) {
  const [tab, setTab] = useState<'abstract' | 'unsplash' | 'upload'>('abstract')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const seeds = coverSeeds(page.id, 12)

  async function searchUnsplash() {
    const q = query.trim()
    if (!q) return
    setSearching(true); setError('')
    try {
      const res = await fetch(`/api/unsplash?query=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.error) setError(data.error)
      setResults(data.results || [])
      setSearched(true)
    } catch {
      setError('Erreur de recherche')
    } finally {
      setSearching(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${userId}/${page.id}-${Date.now()}.${ext}`
      const { error: upErr } = await createClient().storage.from('covers').upload(path, file, { upsert: true })
      if (upErr) { setError(upErr.message); return }
      const { data } = createClient().storage.from('covers').getPublicUrl(path)
      if (data?.publicUrl) await onApply(data.publicUrl)
    } catch {
      setError("Erreur lors de l'envoi")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 px-3 pt-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          {(['abstract', 'unsplash', 'upload'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-sm px-3 py-1.5 rounded-md transition-colors"
              style={{
                background: tab === t ? 'var(--hover-bg)' : 'transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {t === 'abstract' ? 'Abstrait' : t === 'unsplash' ? 'Unsplash' : 'Upload'}
            </button>
          ))}
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-md text-lg transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >×</button>
        </div>

        <div className="p-4 overflow-y-auto">
          {tab === 'abstract' && (
            <div className="grid grid-cols-3 gap-2">
              {seeds.map(seed => (
                <button
                  key={seed}
                  onClick={() => onApply('svg:' + seed)}
                  className="aspect-video rounded-lg overflow-hidden transition-opacity hover:opacity-80"
                  style={{ backgroundImage: `url("${coverDataUri(seed)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
              ))}
            </div>
          )}

          {tab === 'unsplash' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') searchUnsplash() }}
                  placeholder="Rechercher sur Unsplash…"
                  autoFocus
                  className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
                  style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                />
                <button
                  onClick={searchUnsplash}
                  disabled={searching}
                  className="text-sm px-3 py-2 rounded-lg transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
                >
                  {searching ? '…' : 'Chercher'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => onApply(r.regular)}
                    title={r.author ? `© ${r.author}` : undefined}
                    className="aspect-video rounded-lg overflow-hidden transition-opacity hover:opacity-80"
                    style={{ backgroundImage: `url("${r.small || r.thumb}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  />
                ))}
              </div>
              {searched && !searching && results.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Aucun résultat.</p>
              )}
            </div>
          )}

          {tab === 'upload' && (
            <label
              className="flex flex-col items-center justify-center gap-2 py-10 rounded-xl cursor-pointer transition-colors"
              style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
            >
              <span className="text-2xl">⬆️</span>
              <span className="text-sm">{uploading ? 'Envoi…' : 'Choisir une image'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          )}

          {error && <p className="text-xs mt-3" style={{ color: '#ef4444' }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}

export function Cover({ page, userId, onCoverUpdate }: {
  page: Page
  userId: string
  onCoverUpdate?: (coverUrl: string | null) => void
}) {
  const [showModal, setShowModal] = useState(false)
  const hasCustom = !!page.cover_url

  async function applyCover(value: string | null) {
    await createClient().from('pages').up
