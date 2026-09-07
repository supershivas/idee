'use client'
import { useEffect, useState } from 'react'
import { SPLASHES } from './splashes'
import './labo.css'

// Page labo — dix ouvertures d'application à comparer côte à côte avant de
// n'en implémenter qu'une. Destinée à être regardée sur desktop puis retirée.
export default function LaboPage() {
  const [run, setRun] = useState(0)
  const [loop, setLoop] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [dark, setDark] = useState(false)
  const [solo, setSolo] = useState<string | null>(null)

  // Toutes les vignettes rejouent ensemble : décalées, on compare des instants
  // différents de deux animations, ce qui ne veut rien dire.
  useEffect(() => {
    if (!loop) return
    const t = setInterval(() => setRun(r => r + 1), 3400 / speed + 700)
    return () => clearInterval(t)
  }, [loop, speed])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Ralenti : plutôt que de paramétrer chaque durée en CSS, on agit sur le
  // taux de lecture des animations déjà en cours. Elles viennent d'être
  // (re)montées, donc elles démarrent bien au début.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      document.querySelectorAll('.lab-frame').forEach(el => {
        el.getAnimations({ subtree: true }).forEach(a => { a.playbackRate = speed })
      })
    })
    return () => cancelAnimationFrame(id)
  }, [speed, run, solo])

  const shown = solo ? SPLASHES.filter(s => s.id === solo) : SPLASHES

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      <header className="sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center gap-x-5 gap-y-3"
        style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="mr-auto">
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-title)' }}>Labo — ouverture de l’app</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Dix propositions. Choisis-en une (son numéro suffit) et je l’implémente.
          </p>
        </div>

        <button onClick={() => setRun(r => r + 1)}
          className="text-sm font-medium px-3 py-2 rounded-xl"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>
          Tout rejouer
        </button>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /> Boucle
        </label>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Vitesse
          <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
            className="text-sm rounded-lg px-2 py-1"
            style={{ background: 'var(--hover-bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            <option value={0.25}>×0,25</option>
            <option value={0.5}>×0,5</option>
            <option value={1}>×1</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={dark} onChange={e => setDark(e.target.checked)} /> Thème sombre
        </label>

        {solo && (
          <button onClick={() => setSolo(null)} className="text-sm px-3 py-2 rounded-xl"
            style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
            Revoir les dix
          </button>
        )}
      </header>

      <div className="px-6 py-8 flex flex-wrap gap-8 justify-center">
        {shown.map((s, i) => {
          const n = SPLASHES.indexOf(s) + 1
          return (
            <figure key={s.id} className="flex flex-col" style={{ width: 288 }}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{String(n).padStart(2, '0')}</span>
                <figcaption className="font-medium">{s.name}</figcaption>
              </div>

              {/* Cadre au format d'un iPhone, à l'échelle : une ouverture se
                  juge dans ses proportions réelles, pas dans un carré. */}
              <div
                onClick={() => setRun(r => r + 1)}
                className="lab-frame cursor-pointer"
                style={{
                  width: 288, height: 592, borderRadius: 38,
                  border: '1px solid var(--border)',
                  boxShadow: '0 18px 50px rgba(0,0,0,.14)',
                  background: 'var(--app-bg)',
                }}
              >
                {/* La clé force le remontage : c'est ce qui relance les
                    animations CSS, qui ne se rejouent pas autrement. */}
                <div key={`${s.id}-${run}`} className="absolute inset-0">
                  {s.render()}
                </div>
              </div>

              <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.note}</p>
              <button onClick={() => setSolo(s.id)}
                className="text-xs mt-2 self-start px-2 py-1 rounded-lg"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                Voir seule, en grand
              </button>
            </figure>
          )
        })}
      </div>

      <p className="text-xs text-center pb-10" style={{ color: 'var(--text-faint)' }}>
        Page temporaire — à retirer une fois le choix fait.
      </p>
    </div>
  )
}
