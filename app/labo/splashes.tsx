'use client'
import { Bulb } from './Bulb'
import { AppMock } from './AppMock'

// ─────────────────────────────────────────────────────────────────────────────
// Dix ouvertures d'application, toutes bâties sur le même contrat :
//   0 → 0,5 s   le logo apparaît
//   0,5 → 1,4 s temps de chargement (la partie qui doit pouvoir durer)
//   1,4 → 2,3 s le logo s'efface, le contenu prend sa place
// Le « temps de chargement » est ici figé pour la démonstration ; à
// l'implémentation il bouclera jusqu'à ce que l'app soit prête, et la sortie
// se déclenchera à ce moment-là. Chaque animation est donc conçue pour que sa
// phase du milieu soit bouclable sans couture visible.
//
// Tout est en CSS : une ouverture d'app doit être peinte AVANT que le bundle
// JavaScript ne soit exécuté — c'est sa raison d'être. Une bibliothèque
// d'animation arriverait après la fenêtre qu'elle est censée couvrir.
// ─────────────────────────────────────────────────────────────────────────────

const RED = '#C0392B'

export type Splash = {
  id: string
  name: string
  note: string
  render: () => JSX.Element
}

// Fond rouge plein écran, socle commun à la plupart des ouvertures.
function Ground({ children, className = '', style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${className}`}
      style={{ background: RED, ...style }}>
      {children}
    </div>
  )
}

// 1 ── Fondu et souffle ───────────────────────────────────────────────────────
function FadeBreathe() {
  return (
    <>
      <div className="lab-content lab-c-fade"><AppMock /></div>
      <Ground className="lab-g-fade"><Bulb size={104} className="lab-l-fade" /></Ground>
    </>
  )
}

// 2 ── Tracé ──────────────────────────────────────────────────────────────────
function DrawOn() {
  return (
    <>
      <div className="lab-content lab-c-fade"><AppMock /></div>
      <Ground className="lab-g-fade">
        <div className="lab-draw-stack">
          <Bulb size={104} draw className="lab-draw-line" />
          <Bulb size={104} className="lab-draw-fill" />
        </div>
      </Ground>
    </>
  )
}

// 3 ── Iris ───────────────────────────────────────────────────────────────────
function Iris() {
  return (
    <>
      <Ground><Bulb size={104} className="lab-l-iris" /></Ground>
      <div className="lab-content lab-c-iris"><AppMock /></div>
    </>
  )
}

// 4 ── Encre ──────────────────────────────────────────────────────────────────
function Ink() {
  return (
    <>
      <div className="lab-content lab-c-late"><AppMock /></div>
      <Ground className="lab-g-ink"><Bulb size={104} className="lab-l-ink" /></Ground>
    </>
  )
}

// 5 ── Filament ───────────────────────────────────────────────────────────────
function Filament() {
  return (
    <>
      <div className="lab-content lab-c-late"><AppMock /></div>
      <Ground className="lab-g-filament">
        <div className="lab-halo" />
        <Bulb size={104} className="lab-l-filament" />
      </Ground>
    </>
  )
}

// 6 ── Empreinte ──────────────────────────────────────────────────────────────
function Stamp() {
  return (
    <>
      <div className="lab-content lab-c-late"><AppMock /></div>
      <Ground className="lab-g-fade">
        <span className="lab-ripple" />
        <Bulb size={104} className="lab-l-stamp" />
      </Ground>
    </>
  )
}

// 7 ── Rideau ─────────────────────────────────────────────────────────────────
function Curtain() {
  return (
    <>
      <div className="lab-content lab-c-late"><AppMock /></div>
      <div className="lab-curtain lab-curtain-top" />
      <div className="lab-curtain lab-curtain-bottom" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Bulb size={104} className="lab-l-curtain" />
      </div>
    </>
  )
}

// 8 ── Pulsation ──────────────────────────────────────────────────────────────
function Pulse() {
  return (
    <>
      <div className="lab-content lab-c-fade"><AppMock /></div>
      <Ground className="lab-g-fade">
        <span className="lab-ring lab-ring-1" />
        <span className="lab-ring lab-ring-2" />
        <span className="lab-ring lab-ring-3" />
        <Bulb size={104} className="lab-l-pulse" />
      </Ground>
    </>
  )
}

// 9 ── Feuille ────────────────────────────────────────────────────────────────
function PageLift() {
  return (
    <div className="lab-persp">
      <div className="lab-content lab-c-late"><AppMock /></div>
      <Ground className="lab-g-lift"><Bulb size={104} className="lab-l-lift" /></Ground>
    </div>
  )
}

// 10 ── Constellation ─────────────────────────────────────────────────────────
// Douze points partent d'un désordre calculé et convergent sur le cercle de
// l'ampoule, qui se solidifie ensuite.
const DOTS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2
  const R = 38
  return {
    x: Math.cos(a) * R,
    y: Math.sin(a) * R - 11,
    // Départ : même angle, bien plus loin, avec une distance irrégulière.
    fx: Math.cos(a) * (110 + (i % 4) * 26),
    fy: Math.sin(a) * (110 + (i % 3) * 30) - 11,
    d: 60 * (i % 6),
  }
})
function Constellation() {
  return (
    <>
      <div className="lab-content lab-c-late"><AppMock /></div>
      <Ground className="lab-g-fade">
        <div className="lab-dots">
          {DOTS.map((d, i) => (
            <span key={i} className="lab-dot" style={{
              ['--x' as string]: `${d.x}px`, ['--y' as string]: `${d.y}px`,
              ['--fx' as string]: `${d.fx}px`, ['--fy' as string]: `${d.fy}px`,
              animationDelay: `${d.d}ms`,
            }} />
          ))}
          <Bulb size={104} className="lab-l-const" />
        </div>
      </Ground>
    </>
  )
}

export const SPLASHES: Splash[] = [
  { id: 'fade', name: 'Fondu et souffle', note: "Le logo respire une fois, puis cède la place. L'option sobre — celle qu'on ne remarque jamais, ce qui est une qualité.", render: () => <FadeBreathe /> },
  { id: 'draw', name: 'Tracé', note: "L'ampoule se dessine au trait puis se remplit. Artisanal, un peu signature.", render: () => <DrawOn /> },
  { id: 'iris', name: 'Iris', note: "Le logo devient l'ouverture par laquelle le contenu arrive. Le geste le plus net.", render: () => <Iris /> },
  { id: 'ink', name: 'Encre', note: 'Le rouge se retire par le bas comme une eau qui redescend, découvrant la page.', render: () => <Ink /> },
  { id: 'filament', name: 'Filament', note: "L'ampoule s'allume : le halo monte, sature, puis devient le blanc de la page.", render: () => <Filament /> },
  { id: 'stamp', name: 'Empreinte', note: "Le logo tombe avec du poids, l'onde part, puis il file se ranger dans l'en-tête.", render: () => <Stamp /> },
  { id: 'curtain', name: 'Rideau', note: 'Deux volets se séparent. Franc, rapide, très « app installée ».', render: () => <Curtain /> },
  { id: 'pulse', name: 'Pulsation', note: 'Des ondes concentriques marquent le temps de chargement. La phase du milieu boucle sans couture.', render: () => <Pulse /> },
  { id: 'lift', name: 'Feuille', note: "L'écran se soulève comme une page qu'on tourne. Renvoie à l'objet carnet.", render: () => <PageLift /> },
  { id: 'const', name: 'Constellation', note: 'Douze points convergent pour former l\'ampoule. Le plus long des dix — à réserver si le démarrage est lent.', render: () => <Constellation /> },
]
