'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { Page } from './App'

const IconLink = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
    stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 6.5a3 3 0 0 0 4.5.4l1.5-1.5a3 3 0 0 0-4.2-4.3L5.5 2.4" />
    <path d="M8 6.5a3 3 0 0 0-4.5-.4L2 7.6a3 3 0 0 0 4.2 4.3l1.3-1.3" />
  </svg>
)

function generateToken() {
  return crypto.randomUUID().replace(/-/g, '')
}

export default function ShareButton({ page, onUpdate }: {
  page: Page & { is_shared?: boolean; share_token?: string }
  onUpdate: (updates: Partial<Page>) => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPanel, setShowPanel] = useState(false)

  const isShared = page.is_shared
  const shareUrl = page.share_token && typeof window !== 'undefined'
    ? `${window.location.origin}/share/${page.share_token}`
    : null

  async function toggleShare() {
    setLoading(true)
    if (!isShared) {
      const token = page.share_token || generateToken()
      await createClient().from('pages').update({ is_shared: true, share_token: token }).eq('id', page.id)
      onUpdate({ is_shared: true, share_token: token } as any)
    } else {
      await createClient().from('pages').update({ is_shared: false }).eq('id', page.id)
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
    <>
      <button type="button" onClick={() => setShowPanel(true)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-colors text-left"
        style={{ color: 'var(--text-secondary)', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
        <span style={{ opacity: 0.55 }}><IconLink /></span>
        <span className="flex-1">Partager</span>
        {isShared && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--selected-bg)', color: 'var(--text-muted)' }}>
            Actif
          </span>
        )}
      </button>

      {showPanel && mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onMouseDown={e => e.nativeEvent.stopImmediatePropagation()}
          onClick={() => setShowPanel(false)}>
          <div className="w-full max-w-sm rounded-2xl p-5 shadow-xl"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Partage public</p>
              <button onClick={() => setShowPanel(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {isShared ? 'Toute personne avec le lien peut lire cette page.' : 'Activez le partage pour obtenir un lien public.'}
            </p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{isShared ? 'Activé' : 'Désactivé'}</span>
              <button onClick={toggleShare} disabled={loading}
                className="relative inline-flex w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                style={{ background: isShared ? 'var(--btn-primary-bg)' : 'var(--selected-bg)' }}>
                <span className="inline-block w-5 h-5 mt-0.5 rounded-full shadow transition-transform"
                  style={{ background: 'white', transform: isShared ? 'translateX(20px)' : 'translateX(2px)' }} />
              </button>
            </div>
            {isShared && shareUrl && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input readOnly value={shareUrl}
                    className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none truncate"
                    style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }} />
                  <button onClick={copyLink}
                    className="px-2 py-1.5 text-xs rounded-lg flex-shrink-0 transition-colors"
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
                    {copied ? '✓' : 'Copier'}
                  </button>
                </div>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <IconLink />
                  Voir l'aperçu
                </a>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
