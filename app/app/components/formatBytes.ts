// Unités françaises, une décimale tant que le nombre est petit — « 4,2 Mo » se
// lit, « 4404019 octets » non.
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} o`
  const unites = ['ko', 'Mo', 'Go', 'To']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < unites.length - 1) { v /= 1024; i++ }
  // Aucune décimale au-delà de 100, et jamais de « ,0 » traînant, qui donne
  // l'air d'une mesure plus précise qu'elle ne l'est.
  const dec = v >= 100 ? 0 : 1
  return `${v.toFixed(dec).replace(/\.0$/, '').replace('.', ',')} ${unites[i]}`
}
