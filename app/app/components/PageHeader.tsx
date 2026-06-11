'use client'
import React, { useState, useRef, useEffect } from 'react'
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

function Cover({ page, userId, onCoverUpdate }: {
  page: Page
  userId: string
  onCoverUpdate?: (coverUrl: string | null) => void
}) {
  const [showModal, setShowModal] = useState(false)
  const hasCustom = !!page.cover_url

  async function applyCover(value: string | null) {
    await createClient().from('pages').update({ cover_url: value }).eq('id', page.id)
    onCoverUpdate?.(value)
    setShowModal(false)
  }

  return (
<div className="sticky top-0 z-0 group/cover w-full h-28 md:h-44 overflow-hidden">
  <div
        className="absolute inset-0"
        style={{ backgroundImage: `url("${coverBackground(page)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="absolute bottom-2 right-3 flex items-center gap-2 opacity-0 group-hover/cover:opacity-100 transition-opacity">
        <button
          onClick={() => setShowModal(true)}
          className="text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-90"
          style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', backdropFilter: 'blur(4px)' }}
        >
          Modifier la couverture
        </button>
        {hasCustom && (
          <button
            onClick={() => applyCover(null)}
            className="text-xs px-2.5 py-1 rounded-md transition-opacity hover:opacity-90"
            style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', backdropFilter: 'blur(4px)' }}
          >
            Supprimer
          </button>
        )}
      </div>
      {showModal && (
        <CoverModal page={page} userId={userId} onApply={applyCover} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

function BreadcrumbInline({ pages, selected, onSelect }: { pages: Page[], selected: Page | null, onSelect: (p: Page) => void }) {
  if (!selected) return null
  const crumbs: Page[] = []
  let current: Page | undefined = selected
  while (current) { crumbs.unshift(current); current = pages.find(p => p.id === current!.parent_id) }
  const ancestors = crumbs.slice(0, -1)
  if (ancestors.length === 0) return <div className="flex-1 min-w-0" />
  return (
    <div className="flex items-center gap-1 text-xs flex-1 min-w-0 overflow-x-auto" style={{ color: 'var(--text-muted)' }}>
      {ancestors.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
          {i > 0 && <span style={{ color: 'var(--text-faint)' }}>/</span>}
          <button onClick={() => onSelect(crumb)} className="transition-opacity hover:opacity-70 flex items-center gap-1 py-1">
            <span>{crumb.icon || '📄'}</span>
            <span className="whitespace-nowrap">{crumb.title || 'Sans titre'}</span>
          </button>
        </span>
      ))}
      <span style={{ color: 'var(--text-faint)' }} className="flex-shrink-0">/</span>
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs w-24 flex-shrink-0 pt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{children}</div>
    </div>
  )
}

function MetaSection({ page, onCreatedAtChange, onSummaryUpdate }: {
  page: Page
  onCreatedAtChange?: (iso: string) => void
  onSummaryUpdate?: (summary: string | null) => void
}) {
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(page.summary || '')
  const createdInputRef = useRef<HTMLInputElement>(null)
  const relativeModified = useRelativeTime(
    page.updated_at && page.updated_at !== page.created_at ? page.updated_at : null
  )

  function handleCreatedChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value || !onCreatedAtChange) return
    const existing = new Date(page.created_at)
    const [y, m, d] = e.target.value.split('-').map(Number)
    existing.setFullYear(y, m - 1, d)
    onCreatedAtChange(existing.toISOString())
  }

  async function generateSummary() {
    if (!page.content) return
    setLoading(true)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: page.content, title: page.title }),
      })
      const { summary } = await res.json()
      if (summary) {
        await createClient().from('pages').update({ summary }).eq('id', page.id)
        onSummaryUpdate?.(summary)
        setEditValue(summary)
        setEditing(false)
      }
    } finally {
      setLoading(false)
    }
  }

  async function saveSummary() {
    const trimmed = editValue.trim()
    await createClient().from('pages').update({ summary: trimmed || null }).eq('id', page.id)
    onSummaryUpdate?.(trimmed || null)
    setEditing(false)
  }

  async function deleteSummary() {
    await createClient().from('pages').update({ summary: null }).eq('id', page.id)
    onSummaryUpdate?.(null)
    setEditValue('')
    setEditing(false)
  }

  return (
    <div className="px-6 pb-3 pt-1" style={{ borderBottom: '1px solid var(--border)' }}>
      <MetaRow label="Créé le">
        <button
          onClick={() => createdInputRef.current?.showPicker?.() ?? createdInputRef.current?.click()}
          className="transition-opacity hover:opacity-70"
          title="Modifier la date"
        >
          {formatSubtitle(page.created_at)} ✎
        </button>
        <input
          ref={createdInputRef}
          type="date"
          value={page.created_at ? page.created_at.slice(0, 10) : ''}
          onChange={handleCreatedChange}
          className="sr-only"
          tabIndex={-1}
        />
      </MetaRow>
      <MetaRow label="Modifié le">
        {relativeModified || formatSubtitle(page.updated_at)}
      </MetaRow>
      <MetaRow label="Résumé">
        {editing ? (
          <div className="flex flex-col gap-1.5 w-full">
            <textarea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              autoFocus
              rows={3}
              className="w-full text-xs rounded-lg px-2 py-1.5 outline-none resize-none"
              style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveSummary}
                className="text-xs px-2 py-1 rounded-md transition-colors"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
              >
                Enregistrer
              </button>
              <button
                onClick={() => { setEditing(false); setEditValue(page.summary || '') }}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : page.summary ? (
          <div className="flex flex-col gap-1">
            <p className="leading-relaxed">{page.summary}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <button
                onClick={generateSummary}
                disabled={loading}
                className="flex items-center gap-1 text-xs transition-opacity disabled:opacity-40 opacity-50 hover:opacity-100"
                style={{ color: 'var(--text-muted)' }}
              >
                <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
                {loading ? 'Génération…' : 'Régénérer'}
              </button>
              <button
                onClick={() => { setEditValue(page.summary || ''); setEditing(true) }}
                className="text-xs transition-opacity opacity-50 hover:opacity-100"
                style={{ color: 'var(--text-muted)' }}
              >
                ✎ Modifier
              </button>
              <button
                onClick={deleteSummary}
                className="text-xs transition-opacity opacity-50 hover:opacity-100"
                style={{ color: 'var(--text-muted)' }}
              >
                × Supprimer
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={generateSummary}
            disabled={loading || !page.content}
            className="transition-colors disabled:opacity-40"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            {loading ? 'Génération…' : '+ Générer un résumé'}
          </button>
        )}
      </MetaRow>
    </div>
  )
}

export function PageHeader({ page, pages, userId, saving, isMobile, onBack, onSelectPage, onTitleChange, onIconChange, onTagsChange, onToggleFavorite, onDelete, onConvertToJournal, onCreatedAtChange, onRestore, onShareUpdate, onSummaryUpdate, onCoverUpdate }: {
  page: Page
  pages: Page[]
  userId: string
  saving: boolean
  isMobile: boolean
  onBack: () => void
  onSelectPage: (p: Page) => void
  onTitleChange: (v: string) => void
  onIconChange: (emoji: string) => void
  onTagsChange: (tags: string[]) => void
  onToggleFavorite: (id: string) => void
  onDelete: () => void
  onConvertToJournal: () => void
  onCreatedAtChange?: (iso: string) => void
  onRestore: (title: string, content: string) => void
  onShareUpdate: (updates: Partial<Page>) => void
  onSummaryUpdate?: (summary: string | null) => void
  onCoverUpdate?: (coverUrl: string | null) => void
}) {
  const [showIconPicker, setShowIconPicker] = useState(false)
  const isJournal = page.type === 'journal'
  const allTags = Array.from(new Set(pages.flatMap(p => p.tags || [] as string[]))).sort() as string[]

  return (
    <div className="flex-shrink-0">
      {/* Couverture */}
      <Cover page={page} userId={userId} onCoverUpdate={onCoverUpdate} /><div className="relative z-10 flex flex-col" style={{ background: 'var(--card-bg)' }}>
      
        {/* Barre supérieure : breadcrumb/retour + actions */}
      <div className="hidden md:flex items-center justify-between px-6 pt-3 pb-1">
        {isJournal ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            ← Journal
          </button>
        ) : (
          <BreadcrumbInline pages={pages} selected={page} onSelect={onSelectPage} />
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`w-4 h-4 flex items-center justify-center transition-opacity ${saving ? 'opacity-100' : 'opacity-0'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </span>
          <ActionsMenu onDelete={onDelete} onConvertToJournal={isJournal ? undefined : onConvertToJournal}>
            <div className="px-3 py-2.5 text-sm hover:bg-gray-50 border-b"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              <HistoryButton page={page} onRestore={onRestore} />
            </div>
            <div className="px-3 py-2.5 text-sm border-b"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              <ExportButton page={page} />
            </div>
            <div className="px-3 py-2.5 text-sm border-b"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              <ShareButton page={page as any} onUpdate={onShareUpdate} />
            </div>
          </ActionsMenu>
        </div>
      </div>

      {/* Icône + titre + favori */}
      <div className="px-6 pt-2 pb-1">
        <div className="flex items-start gap-3 group/title">
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowIconPicker(v => !v)}
              className="text-4xl hover:opacity-70 transition-opacity"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {page.icon || (isJournal ? '📝' : '📄')}
            </button>
            {showIconPicker && (
              <div className={isMobile ? 'fixed inset-x-4 top-20 z-50' : 'absolute top-full left-0 z-50'}>
                <EmojiPicker
                  onSelect={emoji => { onIconChange(emoji); setShowIconPicker(false) }}
                  onClose={() => setShowIconPicker(false)}
                />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <input
              className="page-title w-full text-2xl md:text-3xl outline-none bg-transparent"
              style={{ caretColor: 'var(--text-primary)', minHeight: '44px' }}
              value={page.title}
              onChange={e => onTitleChange(e.target.value)}
              placeholder="Sans titre"
            />
          </div>
          <button
            onClick={() => onToggleFavorite(page.id)}
            className={`flex-shrink-0 mt-2 text-xl transition-all ${page.favorite ? 'opacity-100' : 'opacity-0 group-hover/title:opacity-100 hover:!opacity-100'}`}
            style={{ color: page.favorite ? '#f59e0b' : 'var(--text-faint)' }}
            title={page.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            {page.favorite ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* Tags + Métadonnées */}
      <div className="px-6 pt-1">
        <MetaRow label="Tags">
          <TagsInput tags={page.tags || []} onChange={onTagsChange} allTags={allTags} compact />
        </MetaRow>
      </div>

      {/* Métadonnées : dates + résumé */}
      <MetaSection
        page={page}
        onCreatedAtChange={onCreatedAtChange}
        onSummaryUpdate={onSummaryUpdate}
      />
      </div>
    </div>
  )
}
