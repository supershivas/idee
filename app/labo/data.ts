// Jeu de pages du banc d'essai — assez proche d'une vraie bibliothèque pour
// que la recherche soit éprouvée : des titres qui se ressemblent, des
// homonymes dans des parents différents, des accents.
export type LaboPage = { id: string; icon: string; title: string; parent?: string }

export const PAGES: LaboPage[] = [
  { id: 'p1', icon: '🌿', title: 'Jardin — plan de printemps', parent: 'Maison 68' },
  { id: 'p2', icon: '🏡', title: 'Maison 68' },
  { id: 'p3', icon: '📓', title: 'Journal du matin' },
  { id: 'p4', icon: '📷', title: 'Repérages photo', parent: 'Projets' },
  { id: 'p5', icon: '✨', title: 'Projets' },
  { id: 'p6', icon: '🍋', title: 'Recettes à essayer' },
  { id: 'p7', icon: '🧭', title: 'Notes de lecture', parent: 'Projets' },
  { id: 'p8', icon: '📗', title: 'Notes de lecture', parent: 'Journal du matin' },
  { id: 'p9', icon: '🇪🇺', title: 'GSC — réunion trimestrielle' },
  { id: 'p10', icon: '💬', title: 'Expressions italiennes' },
  { id: 'p11', icon: '😎', title: 'Été 2026' },
  { id: 'p12', icon: '🔍', title: 'Informazioni' },
]

// Insensible à la casse et aux accents, comme la recherche de l'app.
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function searchPages(q: string, limit = 6): LaboPage[] {
  const n = norm(q.trim())
  if (!n) return PAGES.slice(0, limit)
  return PAGES.filter(p => norm(p.title).includes(n)).slice(0, limit)
}

// Ce qui distingue une adresse d'un mot : un protocole, un « www. », ou
// quelque chose qui ressemble à un domaine. Volontairement permissif — la
// ligne « lien externe » ne coûte rien quand elle apparaît à tort, alors
// qu'une adresse non reconnue oblige à changer de mode.
export function looksLikeUrl(q: string): boolean {
  const s = q.trim()
  if (!s || /\s/.test(s)) return false
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^www\./i.test(s) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)
}

export function toHref(q: string): string {
  const s = q.trim()
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`
}

export function hostOf(q: string): string {
  try { return new URL(toHref(q)).hostname.replace(/^www\./, '') } catch { return q.trim() }
}
