'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { Page } from './App'

const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
    stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6.5" cy="6.5" r="5" />
    <path d="M6.5 3.5v3l2 1.5" />
  </svg>
)

type Snapshot = { id: string; title: string; content: string; created_at: string }

export default function HistoryButton({ page, onRestore }: { page: Page, onRestore: (title: string, content: string) => void }) {
  const [showPanel, setShowPanel] = useState(false)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [preview, setPreview] = useState<Snapshot | null>(null)

  async function loadHistory() {
    setLoading(true)
    const { data } = await createClient().from('page_history')
      .select('id, title, content, created_at')
      .eq('page_id', page.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
    setLoading(false)
  }

  function open() { setShowPanel(true); loadHistory() }

  async function restore(snap: Snapshot) {
    setRestoring(snap.id)
    onRestore(snap.title, snap.content)
    await createClient().from('pages').update({ title: snap.title, content: snap.content, updated_at: new Date().toISOString() }).eq('id', page.id)
    setRestoring(null); setShowPanel(false); setPreview(null)
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      <button type="button" onClick={open}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-colors text-left"
        style={{ color: 'var(--text-secondary)', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
        <span style={{ opacity: 0.55 }}><IconClock /></span>
        <span>Historique</span>
      </button>

      {showPanel && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onMouseDown={e => e.nativeEvent.stopImmediatePropagation()}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Historique</h2>
              <button onClick={() => { setShowPanel(false); setPreview(null) }}
                className="w-7 h-7 flex items-center justify-center rounded-md transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-48 overflow-y-auto flex-shrink-0" style={{ borderRight: '1px solid var(--border)' }}>
                {loading && <p className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Chargement…</p>}
                {!loading && history.length === 0 && <p className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Aucun historique.</p>}
                {history.map((snap, i) => (
                  <button key={snap.id} onClick={() => setPreview(snap)}
                    className="w-full text-left px-4 py-3 transition-colors"
                    style={{ borderBottom: '1px solid var(--border)', background: preview?.id === snap.id ? 'var(--selected-bg)' : 'transparent' }}
                    onMouseEnter={e => { if (preview?.id !== snap.id) e.currentTarget.style.background = 'var(--hover-bg)' }}
                    onMouseLeave={e => { if (preview?.id !== snap.id) e.currentTarget.style.background = 'transparent' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{i === 0 ? 'Version actuelle' : fmt(snap.created_at)}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{snap.title || 'Sans titre'}</p>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {preview ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{preview.title || 'Sans titre'}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{fmt(preview.created_at)}</p>
                      </div>
                      <button onClick={() => restore(preview)} disabled={restoring === preview.id}
                        className="px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50"
                        style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}>
                        {restoring === preview.id ? 'Restauration…' : 'Restaurer'}
                      </button>
                    </div>
                    <div className="prose max-w-none text-sm rounded-lg p-4"
                      style={{ border: '1px solid var(--border)', background: 'var(--hover-bg)' }}
                      dangerouslySetInnerHTML={{ __html: preview.content || '<p>Vide</p>' }} />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sélectionne une version pour prévisualiser</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
