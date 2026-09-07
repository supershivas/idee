'use client'
import { useEffect, useState } from 'react'

// Ouverture de l'app sur mobile : ondes pendant l'attente, iris à l'arrivée.
//
// Rendue par le layout du segment `/app`, donc présente dans le HTML initial :
// elle est peinte avant que le bundle ne s'exécute, ce qui est toute sa raison
// d'être. Et parce qu'elle vit dans le layout, elle ne se démonte pas quand le
// composant serveur de la page se résout — pas de couture entre l'écran
// d'attente et l'app.
//
// Le tout en CSS (voir `globals.css`, section « Ouverture de l'app ») : ce
// composant ne fait que basculer une classe.

// Durée minimale d'affichage. Sans elle, un démarrage à chaud fait clignoter
// l'écran rouge un dixième de seconde — pire que pas d'ouverture du tout.
const MIN_MS = 850
// Durée de l'iris, à garder synchronisée avec `--splash-out` dans globals.css.
const OUT_MS = 620
// Garde-fou : si le signal « prêt » n'arrive jamais (erreur, réseau coupé),
// l'ouverture ne doit pas retenir l'utilisateur en otage.
const SAFETY_MS = 8000

export default function AppSplash() {
  const [phase, setPhase] = useState<'loading' | 'out' | 'done'>('loading')

  useEffect(() => {
    const shownAt = Date.now()
    let started = false
    let outTimer: ReturnType<typeof setTimeout>
    let waitTimer: ReturnType<typeof setTimeout>

    function finish() {
      if (started) return
      started = true
      waitTimer = setTimeout(() => {
        setPhase('out')
        outTimer = setTimeout(() => {
          setPhase('done')
          // La racine ne reprend sa couleur qu'une fois l'ouverture partie :
          // la lâcher au déclenchement laissait, le temps de l'animation, la
          // couleur du document apparaître partout où l'app ne peint pas.
          document.documentElement.classList.remove('splash-up')
        }, OUT_MS)
      }, Math.max(0, MIN_MS - (Date.now() - shownAt)))
    }

    // L'app peut avoir signalé sa disponibilité avant que cet effet ne tourne
    // (au montage initial l'ordre est garanti, mais pas après un remontage) :
    // on lit donc aussi le drapeau, pas seulement l'événement.
    if ((window as any).__ideeReady) finish()
    window.addEventListener('idee:ready', finish)
    const safety = setTimeout(finish, SAFETY_MS)

    return () => {
      window.removeEventListener('idee:ready', finish)
      clearTimeout(safety); clearTimeout(waitTimer); clearTimeout(outTimer)
      document.documentElement.classList.remove('splash-up')
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div className={`app-splash${phase === 'out' ? ' is-out' : ''}`} aria-hidden>
      {phase === 'loading' && (
        <>
          <span className="app-splash-ring" />
          <span className="app-splash-ring r2" />
          <span className="app-splash-ring r3" />
        </>
      )}
      <span className="app-splash-mark" />
    </div>
  )
}
