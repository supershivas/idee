'use client'
import { Mark } from './Mark'
import { AppMock } from './AppMock'

// Les deux retenues, cette fois avec une VRAIE phase de chargement : elle ne
// dure pas un temps décidé d'avance, elle boucle jusqu'à ce que l'app soit
// prête. C'est ce qui distingue une ouverture d'une animation : on ne sait pas
// combien de temps elle devra tenir.
//
//   entrée   480 ms   la marque apparaît
//   chargement  ∞     boucle sans couture, aussi longtemps qu'il faut
//   sortie   620 ms   la marque s'efface, le contenu prend sa place
export type Phase = 'in' | 'loading' | 'out' | 'done'

// ── 03 · Iris ────────────────────────────────────────────────────────────────
// Le cercle respire pendant l'attente, puis s'ouvre : le contenu arrive par la
// marque elle-même. Depuis que la marque est un cercle plein, l'ouverture n'est
// plus une métaphore — c'est littéralement la même forme qui s'agrandit.
export function IrisSplash({ phase }: { phase: Phase }) {
  return (
    <>
      <div className={`lab-layer cand-ground ${phase === 'out' || phase === 'done' ? 'is-out' : ''}`}>
        <Mark size={96} className={`cand-mark-iris ph-${phase}`} />
      </div>
      <div className={`lab-layer cand-content-iris ph-${phase}`}><AppMock /></div>
    </>
  )
}

// ── 08 · Pulsation ───────────────────────────────────────────────────────────
// Des ondes partent de la marque tant que l'app charge. L'attente est lisible
// (il se passe quelque chose) sans jamais afficher de barre de progression
// mensongère — on ne sait pas où on en est, autant ne pas prétendre le savoir.
export function PulseSplash({ phase }: { phase: Phase }) {
  const rings = phase === 'loading'
  return (
    <>
      <div className={`lab-layer cand-ground ${phase === 'out' || phase === 'done' ? 'is-out' : ''}`}>
        {rings && <><span className="cand-ring r1" /><span className="cand-ring r2" /><span className="cand-ring r3" /></>}
        <Mark size={96} className={`cand-mark-pulse ph-${phase}`} />
      </div>
      <div className={`lab-layer cand-content-rise ph-${phase}`}><AppMock /></div>
    </>
  )
}

// ── 03 + 08 ──────────────────────────────────────────────────────────────────
// Les ondes disent l'attente, l'iris dit l'arrivée. Chacune sur la phase où
// elle est la meilleure.
export function PulseIrisSplash({ phase }: { phase: Phase }) {
  const rings = phase === 'loading'
  return (
    <>
      <div className={`lab-layer cand-ground ${phase === 'out' || phase === 'done' ? 'is-out' : ''}`}>
        {rings && <><span className="cand-ring r1" /><span className="cand-ring r2" /><span className="cand-ring r3" /></>}
        <Mark size={96} className={`cand-mark-iris ph-${phase}`} />
      </div>
      <div className={`lab-layer cand-content-iris ph-${phase}`}><AppMock /></div>
    </>
  )
}

export const CANDIDATES = [
  {
    id: 'iris', n: '03', name: 'Iris',
    note: "Le cercle respire pendant l'attente, puis s'ouvre : le contenu arrive par la marque elle-même. La respiration boucle indéfiniment.",
    render: (phase: Phase) => <IrisSplash phase={phase} />,
  },
  {
    id: 'pulse', n: '08', name: 'Pulsation',
    note: "Des ondes partent de la marque tant que l'app charge, puis le contenu monte. L'attente est lisible sans barre de progression mensongère.",
    render: (phase: Phase) => <PulseSplash phase={phase} />,
  },
  {
    id: 'both', n: '03 + 08', name: 'Pulsation puis iris',
    note: "Les ondes disent l'attente, l'iris dit l'arrivée — chacune sur la phase où elle est la meilleure.",
    render: (phase: Phase) => <PulseIrisSplash phase={phase} />,
  },
]
