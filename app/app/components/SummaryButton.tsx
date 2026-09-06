'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Page } from '../types'
import { createClient } from '@/lib/supabase/client'
import { toast } from './Toast'
import { useSwipeDownToDismiss, useBackgroundScrollLock } from './MobileNav'

// Entrée « Résumé » du menu « … » et sa modale — même présentation que les
// autres feuilles de l'app (bottom sheet sur mobile, dialogue centré sur
// desktop, fermeture au swipe). Le résumé occupait auparavant une ligne
// permanente de l'en-tête de note, où il poussait le texte vers le bas alors
// qu'on ne le consulte qu'occasionnellement.
// Entrée « Résumé » du menu « … ». La modale, elle, est rendue par
// `PageHeader` : rendue ici, elle serait démontée en même temps que le menu
// qu'elle fait fermer.
export function SummaryMenuItem({ hasSummary, onClick }: { hasSummary: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-colors text-left"
      style={{ color: 'var(--text-secondary)', background: 'transparent' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
      <i className="ti ti-sparkles" style={{ fontSize: '14px', width: '16px', textAlign: 'center', flexShrink: 0, opacity: 0.55 }} />
      <span>Résumé</span>
      {hasSummary && <span className="ml-auto text-[10px]" style={{ color: 'var(--text-faint)' }}>●</span>}
    </button>
  )
}

// Modale du résumé — même présentation que les autres feuilles de l'app
// (bottom sheet sur mobile, dialogue centré sur desktop, fermeture au swipe).
// Le résumé occupait auparavant une ligne permanente de l'en-tête de note, où
// il poussait le texte vers le bas alors qu'on ne le consulte qu'à l'occasion.
export default function SummaryModal({ page, onSummaryUpdate, onClose }: {
  page: Page
  onSummaryUpdate?: (summary: string | null) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(page.summary || '')

  async function generate() {
    const textContent = (page.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    if (!textContent) {
      toast('La page est vide, rien à résumer.', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: page.content, title: page.title }),
      })
      let data: any = {}
      try { data = await res.json() } catch { data = {} }
      if (!res.ok) {
        toast(data.error || `Erreur serveur (${res.status})`, 'error')
        return
      }
      if (data.summary) {
        await createClient().from('pages').update({ summary: data.summary }).eq('id', page.id)
        onSummaryUpdate?.(data.summary)
        setEditValue(data.summary)
        setEditing(false)
        toast('Résumé généré ✓', 'success')
      } else {
        toast(data.error || 'Résumé vide reçu de Mistral', 'error')
      }
    } catch (err) {
      toast(`Erreur réseau : ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    const trimmed = editValue.trim()
    await createClient().from('pages').update({ summary: trimmed || null }).eq('id', page.id)
    onSummaryUpdate?.(trimmed || null)
    setEditing(false)
  }

  async function remove() {
    await createClient().from('pages').update({ summary: null }).eq('id', page.id)
    onSummaryUpdate?.(null)
    setEditValue('')
    setEditing(false)
  }

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(
    <SummarySheet
      page={page}
      loading={loading}
      editing={editing}
      editValue={editValue}
      setEditValue={setEditValue}
      setEditing={setEditing}
      onGenerate={generate}
      onSave={save}
      onRemove={remove}
      onClose={onClose}
    />,
    document.body
  )
}

function SummarySheet({ page, loading, editing, editValue, setEditValue, setEditing, onGenerate, onSave, onRemove, onClose }: {
  page: Page
  loading: boolean
  editing: boolean
  editValue: string
  setEditValue: (v: string) => void
  setEditing: (v: boolean) => void
  onGenerate: () => void
  onSave: () => void
  onRemove: () => void
  onClose: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const swipe = useSwipeDownToDismiss(onClose, contentRef)
  const backdropRef = useBackgroundScrollLock()

  return (
    <div ref={backdropRef} className="fixed inset-0 bg-black/30 z-[200] flex items-end md:items-center justify-center"
      onClick={onClose} onMouseDown={e => e.nativeEvent.stopImmediatePropagation()}>
      <div
        ref={swipe.sheetRef}
        className="rounded-t-2xl md:rounded-2xl shadow-xl w-full md:w-[480px] md:mx-4 overflow-hidden flex flex-col"
        style={{ background: 'var(--card-bg)', maxHeight: '90vh', ...swipe.style }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 md:hidden" style={{ background: 'var(--border)' }} />

        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Résumé</span>
          <button onClick={onClose}
            className="u-hover-bg w-8 h-8 flex items-center justify-center rounded-lg text-lg"
            style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div ref={contentRef} className="px-5 py-4 overflow-y-auto overscroll-contain flex-1">
          {editing ? (
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={6}
              className="w-full text-sm rounded-lg px-3 py-2.5 outline-none resize-none"
              style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
          ) : page.summary ? (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{page.summary}</p>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <span className="text-3xl">✨</span>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Pas encore de résumé pour cette note.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 flex-shrink-0 safe-bottom" style={{ borderTop: '1px solid var(--border)' }}>
          {editing ? (
            <>
              <button onClick={onSave} className="text-sm px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>Enregistrer</button>
              <button onClick={() => { setEditing(false); setEditValue(page.summary || '') }}
                className="text-sm px-2 py-1.5 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>Annuler</button>
            </>
          ) : (
            <>
              <button onClick={onGenerate} disabled={loading || !page.content}
                className="text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
                {loading ? 'Génération…' : page.summary ? 'Régénérer' : 'Générer'}
              </button>
              {page.summary && (
                <>
                  <button onClick={() => { setEditValue(page.summary || ''); setEditing(true) }}
                    className="text-sm px-2 py-1.5 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>Modifier</button>
                  <button onClick={onRemove}
                    className="text-sm px-2 py-1.5 ml-auto transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>Supprimer</button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
