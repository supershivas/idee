'use client'

type Entry = { version: string; date: string; changes: string[] }

function readChangelog(): Entry[] {
  try {
    return JSON.parse(process.env.NEXT_PUBLIC_APP_CHANGELOG || '[]')
  } catch {
    return []
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Les 5 dernières versions, lues au build depuis public/CHANGELOG.md
// (voir next.config.js). Affiché dans les Réglages, sous la version.
export default function Changelog() {
  const entries = readChangelog()
  if (entries.length === 0) return null
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer select-none text-center py-2" style={{ color: 'var(--text-muted)' }}>
        Nouveautés
      </summary>
      <ol className="mt-2 space-y-3">
        {entries.map(e => (
          <li key={e.version}>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              v{e.version}
              {e.date && <span className="font-normal" style={{ color: 'var(--text-faint)' }}> · {formatDate(e.date)}</span>}
            </p>
            <ul className="mt-1 space-y-0.5 list-disc pl-4" style={{ color: 'var(--text-muted)' }}>
              {e.changes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </details>
  )
}
