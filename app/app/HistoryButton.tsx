'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Page } from './App'

type Snapshot = {
  id: string
  title: string
  content: string
  created_at: string
}

export default function HistoryButton({ page, onRestore }: { page: Page, onRestore: (title: string, content: string) => void }) {
  const [showPanel, setShowPanel] = useState(false)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [preview, setPreview] = useState<Snapshot | null>(null)

  async function loadHistory() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('page_history')
      .select('id, title, content, created_at')
      .eq('page_id', page.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
    setLoading(false)
  }

  function open() {
    setShowPanel(true)
    loadHistory()
  }

  async function restore(snapshot: Snapshot) {
    setRestoring(snapshot.id)
    onRestore(snapshot.title, snapshot.content)
    const supabase = createClient()
    await supabase.from('pages').update({
      title: snapshot.title,
      content: snapshot.content,
      updated_at: new Date().toISOString()
    }).eq('id', page.id)
    setRestoring(null)
    setShowPanel(false)
    setPreview(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <>
      <button
        onClick={open}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 transition-colors"
      >
        <span>🕐</span>
        <span className="hidden sm:inline">Historique</span>
      </button>

      {showPanel && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">Historique des modifications</h2>
              <button onClick={() => { setShowPanel(false); setPreview(null) }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Liste */}
              <div className="w-48 border-r overflow-y-auto flex-shrink-0">
                {loading && <p className="text-sm text-gray-400 p-4">Chargement...</p>}
                {!loading && history.length === 0 && (
                  <p className="text-sm text-gray-400 p-4">Aucun historique.</p>
                )}
                {history.map((snap, i) => (
                  <button
                    key={snap.id}
                    onClick={() => setPreview(snap)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors ${preview?.id === snap.id ? 'bg-gray-100' : ''}`}
                  >
                    <p className="text-xs font-medium text-gray-700">{i === 0 ? 'Version actuelle' : formatDate(snap.created_at)}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{snap.title || 'Sans titre'}</p>
                  </button>
                ))}
              </div>

              {/* Preview */}
              <div className="flex-1 overflow-y-auto p-6">
                {preview ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold text-gray-800">{preview.title || 'Sans titre'}</p>
                        <p className="text-xs text-gray-400">{formatDate(preview.created_at)}</p>
                      </div>
                      <button
                        onClick={() => restore(preview)}
                        disabled={restoring === preview.id}
                        className="px-3 py-1.5 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
                      >
                        {restoring === preview.id ? 'Restauration...' : 'Restaurer'}
                      </button>
                    </div>
                    <div
                      className="prose max-w-none text-sm border rounded-lg p-4 bg-gray-50"
                      dangerouslySetInnerHTML={{ __html: preview.content || '<p class="text-gray-400">Vide</p>' }}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <p className="text-sm">Sélectionne une version pour la prévisualiser</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
