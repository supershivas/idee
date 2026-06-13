'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Page } from '../types'

type Theme = 'light' | 'dark' | 'system'
type Tab = 'general' | 'history'

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

// ── Types ─────────────────────────────────────────────────────────────────────
type HistoryEntry = {
  page_id: string
  title: string
  count: number
  last_at: string
}

type DayGroup = {
  day: string // 'YYYY-MM-DD'
  label: string
  entries: HistoryEntry[]
}

// ── Historique ────────────────────────────────────────────────────────────────
function HistoryTab({ pages, onClose, onNavigate }: {
  pages: Page[]
  onClose: () => void
  onNavigate: (page: Page) => void
}) {
  const [groups, setGroups] = useState<DayGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await createClient()
        .from('page_history')
        .select('page_id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!data) { setLoading(false); return }

      // Grouper par jour puis par page_id
      const byDay: Record<string, Record<string, { title: string; count: number; last_at: string }>> = {}

      for (const row of data) {
        const day = row.created_at.slice(0, 10)
        if (!byDay[day]) byDay[day] = {}
        if (!byDay[day][row.page_id]) {
          byDay[day][row.page_id] = { title: row.title || 'Sans titre', count: 0, last_at: row.created_at }
        }
        byDay[day][row.page_id].count++
        if (row.created_at > byDay[day][row.page_id].last_at) {
          byDay[day][row.page_id].last_at = row.created_at
          byDay[day][row.page_id].title = row.title || 'Sans titre'
        }
      }

      const result: DayGroup[] = Object.entries(byDay)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([day, pages]) => ({
          day,
          label: formatDay(day),
          entries: Object.entries(pages)
            .map(([page_id, v]) => ({ page_id, ...v }))
            .sort((a, b) => b.last_at.localeCompare(a.last_at)),
        }))

      setGroups(result)
      setLoading(false)
    }
    load()
  }, [])

  function formatDay(day: string) {
    const d = new Date(day + 'T12:00:00')
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    if (day === today.toISOString().slice(0, 10)) return "Aujourd'hui"
    if (day === yesterday.toISOString().slice(0, 10)) return 'Hier'
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-gray-400">Chargement…</div>
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <span className="text-3xl">📋</span>
        <p className="text-sm text-gray-400">Aucun historique pour l'instant.</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto flex-1" style={{ maxHeight: '60vh' }}>
      {groups.map(group => (
        <div key={group.day}>
          <p className="px-5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {group.label}
          </p>
          {group.entries.map(entry => {
            const page = pages.find(p => p.id === entry.page_id)
            return (
              <button
                key={entry.page_id}
                onClick={() => {
                  if (page) { onNavigate(page); onClose() }
                }}
                disabled={!page}
                className="w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left disabled:opacity-40"
                style={{ borderBottom: '1px solid var(--border-light, #f0ede8)' }}
                onMouseEnter={e => { if (page) e.currentTarget.style.background = 'var(--hover-bg, #f5f3ef)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span className="text-base flex-shrink-0">{page?.icon || '📄'}</span>
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary, #1a1714)' }}>
                  {entry.title}
                </span>
                <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--selected-bg, #ede9e3)', color: 'var(--text-muted, #9c8e82)' }}>
                  {entry.count} modif{entry.count > 1 ? 's' : ''}
                </span>
                {page && <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-faint, #c4b8ac)' }}>→</span>}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── SettingsPanel ─────────────────────────────────────────────────────────────
export function SettingsPanel({ onClose, onLogout, pages, userId, userEmail, onNavigate }: {
  onClose: () => void
  onLogout: () => void
  pages: Page[]
  userId: string
  userEmail?: string
  onNavigate?: (page: Page) => void
}) {
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('general')

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

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-0 flex-shrink-0">
          {([
            { key: 'general', label: 'Général' },
            { key: 'history', label: 'Historique' },
          ] as { key: Tab, label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: tab === t.key ? 'var(--selected-bg, #ede9e3)' : 'transparent',
                color: tab === t.key ? 'var(--text-primary, #1a1714)' : 'var(--text-muted, #9c8e82)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {tab === 'general' ? (
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
        ) : (
          <HistoryTab
            pages={pages}
            onClose={onClose}
            onNavigate={onNavigate || (() => {})}
          />
        )}

        <div className="md:hidden flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}
