'use client'

// Maquette de l'écran d'accueil mobile, pour juger la transition vers le
// contenu réel plutôt que vers un rectangle vide. Volontairement statique :
// c'est l'animation qu'on regarde, pas elle.
export function AppMock() {
  const rows = [
    { icon: '📓', title: 'Journal du matin', sub: "Aujourd'hui · 3 entrées" },
    { icon: '🌿', title: 'Jardin — plan de printemps', sub: 'Hier' },
    { icon: '📷', title: 'Repérages photo', sub: 'Il y a 2 jours' },
    { icon: '🍋', title: 'Recettes à essayer', sub: 'Il y a 4 jours' },
    { icon: '🧭', title: 'Notes de lecture', sub: 'La semaine dernière' },
  ]
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <div className="flex items-center justify-between px-4 pt-5 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{ background: '#C0392B' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', display: 'block' }} />
          </span>
          <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Idée</span>
        </div>
        <i className="ti ti-settings" style={{ fontSize: 20, color: 'var(--text-muted)' }} />
      </div>

      <div className="flex-1 overflow-hidden px-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl"
            style={{ borderBottom: '1px solid var(--border-light)' }}>
            <span className="text-lg flex-shrink-0">{r.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 pt-3 pb-5 flex-shrink-0">
        <div className="flex-1 flex items-center justify-center gap-2 font-medium text-sm"
          style={{ height: 44, borderRadius: 22, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
          <i className="ti ti-plus" style={{ fontSize: 16 }} /> Nouvelle page
        </div>
        <div className="flex items-center justify-center flex-shrink-0"
          style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--selected-bg)', color: 'var(--text-secondary)' }}>
          <i className="ti ti-search" style={{ fontSize: 17 }} />
        </div>
      </div>
    </div>
  )
}
