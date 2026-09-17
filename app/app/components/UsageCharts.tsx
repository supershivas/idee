'use client'
import { useState } from 'react'
import { formatBytes } from './formatBytes'

// Limites du plan gratuit Supabase (supabase.com/pricing) : 500 Mo de base de
// données, 1 Go de fichiers. L'intérêt du graphique n'est pas le chiffre brut
// mais la distance à ce plafond.
export const QUOTA_DB = 500 * 1024 * 1024
export const QUOTA_STOCKAGE = 1024 * 1024 * 1024

// Au-delà, le quota mérite qu'on le signale — par un mot, pas seulement par une
// couleur, qui ne se lit pas pour tout le monde.
const SEUIL_ALERTE = 0.8

function pourcent(v: number): string {
  if (v > 0 && v < 0.1) return '< 0,1'
  if (v < 100 && v > 99.9) return '> 99,9'
  // Jamais de « 8,0 % » : la décimale nulle laisse croire à une précision.
  return v.toFixed(v >= 10 ? 0 : 1).replace(/\.0$/, '').replace('.', ',')
}

// ── Jauges de quota ──────────────────────────────────────────────────────────
// Une part par rapport à un plafond : une jauge, pas un camembert à deux parts.
// La piste est une version claire de la même teinte, pour que l'état se lise sur
// toute la largeur et pas seulement sur la portion remplie.
function Jauge({ nom, valeur, quota }: { nom: string; valeur: number; quota: number }) {
  const part = Math.min(valeur / quota, 1)
  const alerte = part >= SEUIL_ALERTE
  const libre = Math.max(0, 100 - part * 100)

  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{nom}</span>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {formatBytes(valeur)} / {formatBytes(quota)}
        </span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--chart-track)' }}
        role="img" aria-label={`${nom} : ${pourcent(libre)} % disponible sur le plan gratuit`}>
        {/* Un fond de jauge presque vide doit rester visible : sans ce minimum,
            un poids réel mais minuscule ne se distinguerait pas de zéro. Pas
            d'arrondi propre — c'est la piste qui arrondit le départ ; arrondir
            les deux bouts d'une barre de 6 px en ferait une pastille. */}
        <div className="absolute inset-y-0 left-0"
          style={{ width: `max(6px, ${(part * 100).toFixed(2)}%)`, background: alerte ? 'var(--chart-warn)' : 'var(--chart-fill)' }} />
      </div>
      <p className="text-[10px] mt-1 tabular-nums" style={{ color: alerte ? 'var(--chart-warn)' : 'var(--text-muted)' }}>
        {alerte && <i className="ti ti-alert-triangle mr-1" style={{ fontSize: 10 }} />}
        {pourcent(libre)} % disponible{alerte ? ' — presque plein' : ''}
      </p>
    </div>
  )
}

export function QuotaChart({ texte, images }: { texte: number; images: number }) {
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Plan gratuit Supabase
      </p>
      <Jauge nom="Base de données" valeur={texte} quota={QUOTA_DB} />
      <Jauge nom="Stockage des images" valeur={images} quota={QUOTA_STOCKAGE} />
      <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Estimation : la base compte aussi ses index et son historique.
      </p>
    </div>
  )
}

// ── Évolution ────────────────────────────────────────────────────────────────
export type Point = { d: string; t: number; i: number }

const L = 100 // largeur du repère
const H = 30 // hauteur du repère

function courte(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function TrendChart({ points }: { points: Point[] }) {
  const [survol, setSurvol] = useState<number | null>(null)

  // Une ligne demande au moins deux mesures ; avec une seule, on le dit plutôt
  // que de tracer un trait plat qui ressemblerait à une stagnation.
  if (points.length < 2) {
    return (
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Évolution</p>
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
          La courbe apparaîtra au prochain calcul.
        </p>
      </div>
    )
  }

  const totaux = points.map(p => p.t + p.i)
  const min = Math.min(...totaux)
  const max = Math.max(...totaux)
  // Échelle ajustée à la plage mesurée : sur un total qui ne bouge que de
  // quelques kilo-octets, un axe parti de zéro ne montrerait qu'une ligne plate.
  // L'écart chiffré sous la courbe rétablit l'ordre de grandeur.
  const etendue = max - min || 1
  const x = (k: number) => (points.length === 1 ? L / 2 : (k / (points.length - 1)) * L)
  const y = (v: number) => H - 3 - ((v - min) / etendue) * (H - 6)

  const d = totaux.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const aire = `${d} L${L},${H} L0,${H} Z`

  const delta = totaux[totaux.length - 1] - totaux[0]
  const actif = survol == null ? points.length - 1 : survol

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Évolution</p>
        <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {courte(points[0].d)} → {courte(points[points.length - 1].d)}
        </p>
      </div>

      <div className="relative mt-1.5 select-none" style={{ height: 34 }}
        onMouseLeave={() => setSurvol(null)}
        onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const f = r.width ? (e.clientX - r.left) / r.width : 0
          setSurvol(Math.max(0, Math.min(points.length - 1, Math.round(f * (points.length - 1)))))
        }}>
        {/* preserveAspectRatio non uniforme : le repère s'étire à la largeur
            disponible, mais `non-scaling-stroke` garde un trait de 2 px net. */}
        <svg width="100%" height="34" viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none"
          style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
          <path d={aire} fill="var(--chart-area)" />
          <path d={d} fill="none" stroke="var(--chart-fill)" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Le repère de survol est en HTML : dans un SVG étiré, un cercle
            deviendrait une ellipse. */}
        <div className="absolute rounded-full pointer-events-none"
          style={{
            left: `${(x(actif) / L) * 100}%`, top: (y(totaux[actif]) / H) * 34,
            width: 8, height: 8, marginLeft: -4, marginTop: -4,
            background: 'var(--chart-fill)', boxShadow: '0 0 0 2px var(--selected-bg)',
          }} />
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1.5">
        <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {formatBytes(totaux[actif])} <span style={{ color: 'var(--text-muted)' }}>le {courte(points[actif].d)}</span>
        </span>
        {/* L'échelle est ajustée à la plage mesurée : sans cet écart chiffré, la
            pente ne dirait rien de l'ordre de grandeur. */}
        <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>
          {delta >= 0 ? '+' : '−'}{formatBytes(Math.abs(delta))}
        </span>
      </div>
    </div>
  )
}
