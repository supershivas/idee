'use client'
import { useEffect, useState } from 'react'
import { SPLASHES } from './splashes'
import { CANDIDATES, Phase } from './candidates'
import './labo.css'

// Durées simulées de démarrage : c'est la variable qui compte, puisqu'une
// ouverture doit tenir aussi bien un démarrage instantané qu'un réseau lent.
const BOOTS = [
  { ms: 300, label: '0,3 s — cache chaud' },
  { ms: 1500, label: '1,5 s — démarrage courant' },
  { ms: 4000, label: '4 s — réseau lent' },
]

// Cadre qui joue la vraie machine à états : entrée → chargement (bouclé
// jusqu'à ce que « l'app soit prête ») → sortie.
function CandidateFrame({ render, boot, run }: {
  render: (p: Phase) => JSX.Element
  boot: number
  run: number
}) {
  const [phase, setPhase] = useState<Phase>('in')

  useEffect(() => {
    setPhase('in')
    const t1 = setTimeout(() => setPhase('loading'), 480)
    // Ce minuteur tient lieu de « l'app est prête » : à l'implémentation, ce
    // sera la promesse de chargement des données qui déclenchera la sortie.
    const t2 = setTimeout(() => setPhase('out'), 480 + boot)
    const t3 = setTimeout(() => setPhase('done'), 480 + boot + 640)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [boot, run])

  return (
    <div className="lab-frame" style={{
      width: 288, height: 592, borderRadius: 38,
      border: '1px solid var(--border)', boxShadow: '0 18px 50px rgba(0,0,0,.14)',
      background: 'var(--app-bg)',
    }}>
      {render(phase)}
    </div>
  )
}

export default function LaboPage() {
  const [run, setRun] = useState(0)
  const [boot, setBoot] = useState(1500)
  const [dark, setDark] = useState(false)
  const [showOthers, setShowOthers] = useState(false)

  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  // Rejeu automatique, calé sur la durée totale du cycle en cours.
  useEffect(() => {
    const t = setInterval(() => setRun(r => r + 1), 480 + boot + 640 + 1100)
    return () => clearInterval(t)
  }, [boot])

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      <header className="sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center gap-x-5 gap-y-3"
        style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="mr-auto">
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-title)' }}>Labo — ouverture de l’app</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            03 et 08 avec une vraie phase de chargement, plus leur combinaison. Marque : cercle blanc.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Démarrage simulé
          <select value={boot} onChange={e => setBoot(Number(e.target.value))}
            className="text-sm rounded-lg px-2 py-1"
            style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            {BOOTS.map(b => <option key={b.ms} value={b.ms}>{b.label}</option>)}
          </select>
        </label>

        <button onClick={() => setRun(r => r + 1)} className="text-sm font-medium px-3 py-2 rounded-xl"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
          Rejouer
        </button>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={dark} onChange={e => setDark(e.target.checked)} /> Thème sombre
        </label>
      </header>

      <div className="px-6 pt-8 pb-4 flex flex-wrap gap-10 justify-center">
        {CANDIDATES.map(c => (
          <figure key={c.id} className="flex flex-col" style={{ width: 288 }}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{c.n}</span>
              <figcaption className="font-medium">{c.name}</figcaption>
            </div>
            <CandidateFrame render={c.render} boot={boot} run={run} />
            <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.note}</p>
          </figure>
        ))}
      </div>

      <div className="px-6 pb-12 text-center">
        <button onClick={() => setShowOthers(v => !v)} className="text-sm px-3 py-2 rounded-xl"
          style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
          {showOthers ? 'Masquer' : 'Revoir'} les sept autres, avec la nouvelle marque
        </button>

        {showOthers && (
          <div className="pt-8 flex flex-wrap gap-8 justify-center">
            {SPLASHES.filter(s => s.id !== 'iris' && s.id !== 'pulse').map(s => (
              <figure key={s.id} className="flex flex-col" style={{ width: 240 }}>
                <figcaption className="font-medium text-sm mb-2 text-left">{s.name}</figcaption>
                <div className="lab-frame lab-frame-timeline" style={{
                  width: 240, height: 494, borderRadius: 32,
                  border: '1px solid var(--border)', background: 'var(--app-bg)',
                }}>
                  <div key={`${s.id}-${run}`} className="absolute inset-0">{s.render()}</div>
                </div>
              </figure>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-center pb-10" style={{ color: 'var(--text-faint)' }}>
        Page temporaire — à retirer une fois le choix fait.
      </p>
    </div>
  )
}
