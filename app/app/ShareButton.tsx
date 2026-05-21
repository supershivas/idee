'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Page } from './App'

function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export default function ShareButton({ page, onUpdate }: { page: Page & { is_shared?: boolean, share_token?: string }, onUpdate: (updates: Partial<Page>) => void }) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPanel, setShowPanel] = useState(false)

  const isShared = page.is_shared
  const shareUrl = page.share_token
    ? `${window.location.origin}/share/${page.share_token}`
    : null

  async function toggleShare() {
    setLoading(true)
    const supabase = createClient()

    if (!isShared) {
      const token = page.share_token || generateToken()
      await supabase.from('pages').update({ is_shared: true, share_token: token }).eq('id', page.id)
      onUpdate({ is_shared: true, share_token: token } as any)
    } else {
      await supabase.from('pages').update({ is_shared: false }).eq('id', page.id)
      onUpdate({ is_shared: false } as any)
    }
    setLoading(false)
  }

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 transition-colors"
      >
        <span>{isShared ? '🔗' : '🔒'}</span>
        <span className="hidden sm:inline">{isShared ? 'Partagé' : 'Partager'}</span>
      </button>

      {showPanel && (
        <div className="absolute right-0 top-full mt-2 bg-white border rounded-xl shadow-xl p-4 w-72 z-50">
          <p className="text-sm font-medium text-gray-800 mb-1">Partage public</p>
          <p className="text-xs text-gray-400 mb-3">
            {isShared ? 'Toute personne avec le lien peut lire cette page.' : 'Activez le partage pour obtenir un lien public.'}
          </p>

          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">{isShared ? 'Activé' : 'Désactivé'}</span>
            <button
  onClick={toggleShare}
  disabled={loading}
  className={`relative inline-flex w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${isShared ? 'bg-black' : 'bg-gray-200'}`}
>
  <span className={`inline-block w-5 h-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${isShared ? 'translate-x-5' : 'translate-x-0.5'}`} />
</button>
          </div>

          {isShared && shareUrl && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 text-xs border rounded-lg px-2 py-1.5 text-gray-500 bg-gray-50 outline-none truncate"
              />
              <button
                onClick={copyLink}
                className="px-2 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-gray-800 flex-shrink-0"
              >
                {copied ? '✓' : 'Copier'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
