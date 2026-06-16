'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Page } from '../types'

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

function formatDay(day: string) {
  const d = new Date(day + 'T12:00:00')
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (day === today.toISOString().slice(0, 10)) return "Aujourd'hui"
  if (day === yesterday.toISOString().slice(0, 10)) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function HistoryModal({ pages, onClose, onNavigate }: {
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

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-xl w-full md:w-[480px] md:mx-4 overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 md:hidden" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <span className="font-semibold text-gray-900 dark:text-white">Historique</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">✕</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">Chargement…</div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-3xl">📋</span>
            <p className="text-sm text-gray-400">Aucun historique pour l'instant.</p>
          </div>
        ) : (
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
        )}

        <div className="md:hidden flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}
