'use client'
import { useState } from 'react'
import { Page } from '../types'
import { createClient } from '@/lib/supabase/client'

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs w-24 flex-shrink-0 pt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{children}</div>
    </div>
  )
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function PageMeta({ page, onChange }: { page: Page; onChange: (updates: Partial<Page>) => void }) {
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summary, setSummary] = useState<string | null>(page.summary || null)
  const [tags, setTags] = useState<string[]>(page.tags || [])
  const [tagInput, setTagInput] = useState('')

  async function generateSummary() {
    if (!page.content) return
    setLoadingSummary(true)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: page.content, title: page.title }),
      })
      const { summary: s } = await res.json()
      if (s) {
        await createClient().from('pages').update({ summary: s }).eq('id', page.id)
        setSummary(s)
        onChange({ summary: s })
      }
    } finally {
      setLoadingSummary(false)
    }
  }

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase()
    if (!t || tags.includes(t)) return
    const next = [...tags, t]
    setTags(next)
    onChange({ tags: next })
  }

  function removeTag(tag: string) {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    onChange({ tags: next })
  }

  return (
    <div className="px-6 pb-2 pt-1" style={{ borderBottom: '1px solid var(--border)' }}>
      <MetaRow label="Tags">
        <div className="flex flex-wrap items-center gap-1">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
              style={{ background: 'var(--tag-bg)', color: 'var(--tag-fg)' }}>
              {tag}
              <button onClick={() => removeTag(tag)} className="opacity-50 hover:opacity-100 leading-none">×</button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); setTagInput('') }
              if (e.key === 'Backspace' && !tagInput && tags.length) removeTag(tags[tags.length - 1])
            }}
            placeholder={tags.length ? '' : 'Ajouter un tag…'}
            className="outline-none bg-transparent text-xs min-w-16"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </MetaRow>

      <MetaRow label="Créé le">{formatDate(page.created_at)}</MetaRow>
      <MetaRow label="Modifié le">{formatDate(page.updated_at)}</MetaRow>

      <MetaRow label="Résumé">
        {summary ? (
          <div className="flex flex-col gap-1.5">
            <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{summary}</p>
            <button
              onClick={generateSummary}
              disabled={loadingSummary}
              className="self-start flex items-center gap-1 text-xs transition-opacity disabled:opacity-40 opacity-40 hover:opacity-100"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className={loadingSummary ? 'animate-spin' : ''}>↻</span>
              {loadingSummary ? 'Génération…' : 'Régénérer'}
            </button>
          </div>
        ) : (
          <button
            onClick={generateSummary}
            disabled={loadingSummary || !page.content}
            className="text-xs transition-colors disabled:opacity-40"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
          >
            {loadingSummary ? 'Génération…' : '+ Générer un résumé'}
          </button>
        )}
      </MetaRow>
    </div>
  )
}
