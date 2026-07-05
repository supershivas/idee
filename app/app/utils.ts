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
