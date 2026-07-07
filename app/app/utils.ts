import { Page } from './types'

// Normalisation pour la recherche : sans accents, en minuscules.
export function normalizeStr(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
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
