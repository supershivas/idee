import { Page } from './types'

// Normalisation pour la recherche : sans accents, en minuscules.
export function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Deux tags qui ne diffèrent que par les accents ou la casse sont le même
// tag : « poesie » et « Poésie » se rangent sous la même clé.
export function tagKey(tag: string) {
  return normalizeStr(tag.trim())
}

function accentCount(s: string) {
  return (s.normalize('NFD').match(/[\u0300-\u036f]/g) || []).length
}

// Orthographe retenue pour chaque clé de tag : la plus accentuée
// (« poésie » plutôt que « poesie »), puis la plus utilisée.
export function canonicalTags(pages: Page[]): Map<string, string> {
  const counts = new Map<string, number>()
  pages.forEach(p => (p.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)))
  const canon = new Map<string, string>()
  counts.forEach((n, t) => {
    const key = tagKey(t)
    const best = canon.get(key)
    if (!best) { canon.set(key, t); return }
    const diff = accentCount(t) - accentCount(best)
    if (diff > 0 || (diff === 0 && n > (counts.get(best) || 0))) canon.set(key, t)
  })
  return canon
}

// Remplace chaque tag par son orthographe retenue et retire les doublons.
export function mergeTagVariants(tags: string[], canon: Map<string, string>): string[] {
  const out: string[] = []
  tags.forEach(t => {
    const c = canon.get(tagKey(t)) ?? t
    if (!out.some(o => tagKey(o) === tagKey(c))) out.push(c)
  })
  return out
}

export function getAncestorIds(pages: Page[], pageId: string): string[] {
  const ids: string[] = []
  let current = pages.find(p => p.id === pageId)
  while (current?.parent_id) {
    ids.push(current.parent_id)
    current = pages.find(p => p.id === current!.parent_id)
  }
  return ids
}

// Tous les descendants (sous-pages, sous-sous-pages, …), supprimés inclus.
export function getDescendantIds(pages: Page[], rootId: string): string[] {
  const children = pages.filter(p => p.parent_id === rootId)
  return children.flatMap(c => [c.id, ...getDescendantIds(pages, c.id)])
}

// Slug d'URL : « Ma page à idées » → « ma-page-a-idees »
export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'sans-titre'
}

// Extrait les chemins d'objets Storage (relatifs au bucket) présents dans un
// texte, à partir des URLs publiques Supabase du bucket donné. Ex. :
//   https://<proj>.supabase.co/storage/v1/object/public/images/<uid>/<file>
//   → "<uid>/<file>"
// Utilisé pour retrouver les images/couvertures uploadées d'une note afin de
// les supprimer du Storage quand la note est supprimée définitivement.
export function extractStoragePaths(text: string, bucket: string, supabaseUrl: string): string[] {
  if (!text || !supabaseUrl) return []
  const base = `${supabaseUrl}/storage/v1/object/public/${bucket}/`
  const paths: string[] = []
  let idx = text.indexOf(base)
  while (idx !== -1) {
    const start = idx + base.length
    // Le chemin s'arrête au premier caractère de fin d'URL (guillemet,
    // parenthèse, espace, chevron…).
    const match = text.slice(start).match(/^[^"')\s<>\\]+/)
    if (match) {
      try { paths.push(decodeURIComponent(match[0])) } catch { paths.push(match[0]) }
    }
    idx = text.indexOf(base, start)
  }
  return paths
}
