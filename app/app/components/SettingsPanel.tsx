'use client'
import { useEffect, useState } from 'react'
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
export function SettingsPanel({ onClose, onLogout, pages, userId, userEmail }: {
  onClose: () => void
  onLogout: () => void
  pages: Page[]
  userId: string
  userEmail?: string
}) {
  const { theme, setTheme } = useTheme()
  const totalPages = pages.filter(p => !p.deleted_at && p.type !== 'journal').length
  const journalCount = pages.filter(p => !p.deleted_at && p.type === 'journal').length
  const trashedCount = pages.filter(p => !!p.deleted_at).length
  const favoriteCount = pages.filter(p => p.favorite && !p.deleted_at).length

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
