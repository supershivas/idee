'use client'

// La marque : un simple cercle blanc. Elle reprend le globe de l'ampoule — le
// culot et les stries ne survivaient de toute façon pas à la taille d'une
// icône d'écran d'accueil.
//
// Ici le cercle remplit le cadre, donc `size` est bien son diamètre. Les
// fichiers de `public/` posent le même cercle à 52 % du côté d'un carré rouge :
// c'est le carré qui donne l'icône, le cercle seul qui donne l'ouverture.
export function Mark({ size = 96, color = '#fff', draw = false, className = '', style }: {
  size?: number
  color?: string
  // `draw` : rendu en trait, pour l'animation qui dessine la marque.
  draw?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg viewBox="0 0 180 180" width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="90" cy="90" r={draw ? 84 : 90}
        {...(draw
          ? { fill: 'none', stroke: color, strokeWidth: 11, strokeLinecap: 'round' as const }
          : { fill: color })} />
    </svg>
  )
}
