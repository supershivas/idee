'use client'

// L'ampoule de l'icône d'application, en vectoriel : la version PNG ne se
// laisse ni tracer, ni masquer, ni détourer. Les proportions suivent
// `public/apple-touch-icon.png` (viewBox 180 pour coller à ses 180px).
export function Bulb({ size = 96, color = '#fff', draw = false, className = '', style }: {
  size?: number
  color?: string
  // `draw` : rendu en trait, pour les animations qui dessinent le logo.
  draw?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const stroke = draw ? { fill: 'none', stroke: color, strokeWidth: 7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const } : { fill: color }
  return (
    <svg viewBox="0 0 180 180" width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="90" cy="70" r="40" {...stroke} />
      <path d="M74 108 h32 v6 h-32 z" {...stroke} />
      <rect x="76" y="120" width="28" height="6" rx="3" {...stroke} />
      <rect x="76" y="131" width="28" height="6" rx="3" {...stroke} />
      <rect x="80" y="142" width="20" height="6" rx="3" {...stroke} />
    </svg>
  )
}
