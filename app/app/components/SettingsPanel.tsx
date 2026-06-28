'use client'
import { useEffect, useRef, useState } from 'react'
import { Page } from '../types'

type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem('idee-theme') as Theme) || 'system'
  })

  useEffect(() => {
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
    root.classList.toggle('dark', isDark)
    localStorage.setItem('idee-theme', theme)
  }, [theme])

  return { theme, setTheme }
}

// ── SettingsPanel ─────────────────────────────────────────────────────────────
export function SettingsPanel({ onClose, onLogout, onImport, pages, userId, userEmail }: {
  onClose: () => void
  onLogout: () => void
  onImport: (pages: Omit<Page, 'user_id'>[]) => Promise<{ count: number; errors: number }>
  pages: Page[]
  userId: string
  userEmail?: string
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

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-xl w-full md:w-[480px] md:mx-4 overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle mobile */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 md:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <span className="font-semibold text-gray-900 dark:text-white">Paramètres</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">✕</button>
        </div>

        {/* Contenu */}
        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
            {/* Apparence */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Apparence</p>
              <div className="flex gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-sm
                      ${theme === t.value
                        ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-800'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Compte */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Compte</p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 space-y-1.5">
                {userEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Email</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{userEmail}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">ID</span>
                  <span className="text-xs text-gray-400 font-mono truncate max-w-40">{userId.slice(0, 8)}…</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contenu</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Pages',    value: totalPages,    icon: '📄' },
                  { label: 'Journal',  value: journalCount,  icon: '📓' },
                  { label: 'Favoris',  value: favoriteCount, icon: '★' },
                  { label: 'Corbeille',value: trashedCount,  icon: '🗑' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <span className="text-base">{s.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{s.value}</p>
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Données */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Données</p>
              <div className="space-y-2">
                <button
                  onClick={exportJSON}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <span className="text-lg">⬇️</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">Exporter mes données</p>
                    <p className="text-xs text-gray-400">JSON · pages + journal (corbeille exclue)</p>
                  </div>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left disabled:opacity-50"
                >
                  <span className="text-lg">{importing ? '⏳' : '⬆️'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">
                      {importing ? 'Import en cours…' : 'Importer des données'}
                    </p>
                    <p className="text-xs text-gray-400">
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

            {/* Applications */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Applications</p>
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
                    className="flex-1 flex flex-col items-center gap-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={app.name}
                  >
                    <img src={app.favicon} alt="" width={20} height={20} className="rounded-sm" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <span className="text-[10px] text-gray-400">{app.name}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Déconnexion */}
            <button
              onClick={onLogout}
              className="w-full py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 text-sm font-medium transition-colors"
            >
              Se déconnecter
            </button>
        </div>

        <div className="md:hidden flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}
