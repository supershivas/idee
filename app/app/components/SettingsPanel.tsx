'use client'
import { useEffect, useRef, useState } from 'react'
import { Page } from '../types'
import { useSwipeDownToDismiss, useBackgroundScrollLock } from './MobileNav'

type Theme = 'light' | 'dark' | 'system'

function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem('idee-theme') as Theme) || 'system'
  })

  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    function apply() {
      const isDark = theme === 'dark' || (theme === 'system' && mq.matches)
      root.classList.toggle('dark', isDark)
      // `theme-color` teinte l'interface du navigateur (barre d'adresse Safari,
      // barre d'état Android). Figée sur la couleur claire, elle restait claire
      // en thème sombre. On la relit depuis `--app-bg` plutôt que d'en
      // recopier la valeur ici : les couleurs restent dans globals.css.
      const bg = getComputedStyle(root).getPropertyValue('--app-bg').trim()
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta && bg) meta.setAttribute('content', bg)
    }

    apply()
    localStorage.setItem('idee-theme', theme)
    // En mode « système », suivre les bascules jour/nuit de l'iPhone tant que
    // l'app est ouverte — sans quoi elle restait claire jusqu'au rechargement.
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  return { theme, setTheme }
}

// ── SettingsPanel ─────────────────────────────────────────────────────────────
export function SettingsPanel({ onClose, onLogout, onImport, pages, userId, userEmail, onShowTrash, onShowReview, onShowRecent }: {
  onClose: () => void
  onLogout: () => void
  onImport: (pages: Omit<Page, 'user_id'>[]) => Promise<{ count: number; errors: number }>
  pages: Page[]
  userId: string
  userEmail?: string
  // Écrans qui avaient chacun leur bouton en haut de l'écran d'accueil mobile
  // (corbeille, révision, vue récente) : ils vivent désormais ici. Le compte
  // d'éléments en corbeille est déjà calculé plus bas depuis `pages`.
  onShowTrash?: () => void
  onShowReview?: () => void
  onShowRecent?: () => void
}) {
  const { theme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<{ ok?: number; err?: number } | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportStatus(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('Format invalide')
      const { count, errors } = await onImport(data)
      setImportStatus({ ok: count, err: errors })
    } catch {
      setImportStatus({ ok: 0, err: -1 })
    } finally {
      setImporting(false)
    }
  }

  const totalPages = pages.filter(p => !p.deleted_at && p.type !== 'journal').length
  const journalCount = pages.filter(p => !p.deleted_at && p.type === 'journal').length
  const trashedCount = pages.filter(p => !!p.deleted_at).length
  const favoriteCount = pages.filter(p => p.favorite && !p.deleted_at).length

  function exportJSON() {
    const data = pages.filter(p => !p.deleted_at)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `idee-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const THEMES: { value: Theme, label: string, icon: string }[] = [
    { value: 'light', label: 'Clair',   icon: '☀️' },
    { value: 'dark',  label: 'Sombre',  icon: '🌙' },
    { value: 'system',label: 'Système', icon: '💻' },
  ]

  const contentRef = useRef<HTMLDivElement>(null)
  const swipe = useSwipeDownToDismiss(onClose, contentRef)
  const backdropRef = useBackgroundScrollLock()

  return (
    <div ref={backdropRef} className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        ref={swipe.sheetRef}
        className="rounded-t-2xl md:rounded-2xl shadow-xl w-full md:w-[480px] md:mx-4 overflow-hidden flex flex-col"
        style={{ background: 'var(--card-bg)', maxHeight: '90vh', ...swipe.style }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 md:hidden" style={{ background: 'var(--border)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Paramètres</span>
          <button onClick={onClose}
            className="u-hover-bg w-8 h-8 flex items-center justify-center rounded-lg text-lg"
            style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Contenu */}
        <div ref={contentRef} className="px-5 py-4 space-y-5 overflow-y-auto overscroll-contain flex-1">
            {/* Accès rapides — d'abord, parce qu'on ouvre bien plus souvent les
                paramètres pour atteindre la corbeille que pour changer de
                thème. Masqués sur desktop, où la sidebar les propose déjà. */}
            {(onShowTrash || onShowReview || onShowRecent) && (
              <div className="md:hidden">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Naviguer</p>
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--selected-bg)' }}>
                  {onShowRecent && (
                    <button onClick={onShowRecent} className="u-hover-bg w-full flex items-center gap-3 px-4 py-3 text-sm text-left" style={{ color: 'var(--text-primary)' }}>
                      <i className="ti ti-clock-hour-4" style={{ fontSize: '15px', width: 18, opacity: 0.6 }} />
                      <span className="flex-1">Vue récente</span>
                      <i className="ti ti-chevron-right" style={{ fontSize: '13px', color: 'var(--text-faint)' }} />
                    </button>
                  )}
                  {onShowReview && (
                    <button onClick={onShowReview} className="u-hover-bg w-full flex items-center gap-3 px-4 py-3 text-sm text-left" style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border)' }}>
                      <i className="ti ti-refresh" style={{ fontSize: '15px', width: 18, opacity: 0.6 }} />
                      <span className="flex-1">Mode révision</span>
                      <i className="ti ti-chevron-right" style={{ fontSize: '13px', color: 'var(--text-faint)' }} />
                    </button>
                  )}
                  {onShowTrash && (
                    <button onClick={onShowTrash} className="u-hover-bg w-full flex items-center gap-3 px-4 py-3 text-sm text-left" style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border)' }}>
                      <i className="ti ti-trash" style={{ fontSize: '15px', width: 18, opacity: 0.6 }} />
                      <span className="flex-1">Corbeille</span>
                      {trashedCount > 0 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>{trashedCount}</span>
                      )}
                      <i className="ti ti-chevron-right" style={{ fontSize: '13px', color: 'var(--text-faint)' }} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Ordre : ce qu'on vient faire souvent d'abord (naviguer, changer de
                thème), l'administratif ensuite. « Contenu » et « Données » se
                chevauchaient — elles deviennent « Ma bibliothèque » (ce que
                contient le compte) et « Sauvegarde » (ce qu'on en sort ou y
                remet). La déconnexion rejoint le compte, la version rejoint
                « À propos ». */}
            {/* Apparence */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Apparence</p>
              <div className="flex gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-sm"
                    style={{
                      borderColor: theme === t.value ? 'var(--text-primary)' : 'var(--border)',
                      background: theme === t.value ? 'var(--selected-bg)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (theme !== t.value) e.currentTarget.style.borderColor = 'var(--text-faint)' }}
                    onMouseLeave={e => { if (theme !== t.value) e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Ma bibliothèque */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Ma bibliothèque</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Pages',    value: totalPages,    icon: '📄' },
                  { label: 'Journal',  value: journalCount,  icon: '📓' },
                  { label: 'Favoris',  value: favoriteCount, icon: '★' },
                  { label: 'Corbeille',value: trashedCount,  icon: '🗑' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'var(--selected-bg)' }}>
                    <span className="text-base">{s.icon}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sauvegarde */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Sauvegarde</p>
              <div className="space-y-2">
                <button
                  onClick={exportJSON}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left"
                  style={{ background: 'var(--selected-bg)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--selected-bg)')}
                >
                  <span className="text-lg">⬇️</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Exporter mes données</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>JSON · pages + journal (corbeille exclue)</p>
                  </div>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left disabled:opacity-50"
                  style={{ background: 'var(--selected-bg)' }}
                  onMouseEnter={e => { if (!importing) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--selected-bg)')}
                >
                  <span className="text-lg">{importing ? '⏳' : '⬆️'}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {importing ? 'Import en cours…' : 'Importer des données'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {importStatus
                        ? importStatus.err === -1
                          ? '❌ Fichier invalide'
                          : `✅ ${importStatus.ok} page(s) importée(s)${importStatus.err ? `, ${importStatus.err} erreur(s)` : ''}`
                        : 'JSON exporté depuis idee'}
                    </p>
                  </div>
                </button>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
              </div>
            </div>

            {/* Compte */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Compte</p>
              <div className="rounded-xl px-4 py-3 space-y-1.5" style={{ background: 'var(--selected-bg)' }}>
                {userEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Email</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{userEmail}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>ID</span>
                  <span className="text-xs font-mono truncate max-w-40" style={{ color: 'var(--text-faint)' }}>{userId.slice(0, 8)}…</span>
                </div>
              </div>
            </div>

{/* Déconnexion */}
            <button
              onClick={onLogout}
              className="w-full py-3 rounded-xl border text-sm font-medium transition-colors"
              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Se déconnecter
            </button>

            {/* À propos */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>À propos</p>
              <div className="flex gap-2">
                {[
                  { name: 'Source', url: 'https://source-sigma-kohl.vercel.app/app', favicon: 'https://source-sigma-kohl.vercel.app/favicon.ico' },
                  { name: 'AutoCompare', url: 'https://supershivas.github.io/projetV/', favicon: 'https://supershivas.github.io/projetV/favicon.ico' },
                  { name: 'Portfolio', url: 'https://stockportfolio-five.vercel.app/', favicon: 'https://stockportfolio-five.vercel.app/favicon.ico' },
                ].map(app => (
                  <a
                    key={app.name}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex flex-col items-center gap-1.5 rounded-xl px-3 py-2.5 transition-colors"
                    style={{ background: 'var(--selected-bg)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--selected-bg)')}
                    title={app.name}
                  >
                    <img src={app.favicon} alt="" width={20} height={20} className="rounded-sm" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{app.name}</span>
                  </a>
                ))}
              </div>

              {/* Version, sous les autres applications : c'est de
                  l'information sur l'app, pas un réglage. */}
              <p className="text-center text-[11px] mt-3" style={{ color: 'var(--text-faint)' }}>
                Version {process.env.NEXT_PUBLIC_APP_VERSION}
                {process.env.NEXT_PUBLIC_APP_UPDATED_AT && (
                  <> · Mis à jour le {formatUpdatedAt(process.env.NEXT_PUBLIC_APP_UPDATED_AT)}</>
                )}
              </p>
            </div>
        </div>

        <div className="md:hidden flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}
