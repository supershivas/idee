import { Page } from './types'

// Ce qui distingue une adresse d'un mot : un protocole, un « www. », ou
// quelque chose qui ressemble à un domaine. Volontairement permissif — une
// ligne « lien externe » proposée à tort ne coûte rien, alors qu'une adresse
// non reconnue obligerait à changer de mode, ce que cette interface évite
// justement.
export function looksLikeUrl(q: string): boolean {
  const s = q.trim()
  if (!s || /\s/.test(s)) return false
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^www\./i.test(s) || /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s)
}

export function toHref(q: string): string {
  const s = q.trim()
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`
}

// Nom de domaine seul, pour ne pas afficher une adresse de trois lignes.
export function hostOf(q: string): string {
  try { return new URL(toHref(q)).hostname.replace(/^www\./, '') } catch { return q.trim() }
}

// Une adresse de l'app désigne une page : collée sur une sélection, elle doit
// donner un lien de page et non un lien externe qui rechargerait l'app.
// Reconnaît `/app?page=<id>` (l'adresse qu'on copie depuis la barre du
// navigateur) et `#<id>` (la forme interne des liens de page).
export function pageIdFromUrl(raw: string, pages: Page[]): string | null {
  const s = raw.trim()
  const hash = s.match(/^#([0-9a-f-]{8,})$/i)
  if (hash) return pages.some(p => p.id === hash[1]) ? hash[1] : null
  try {
    const u = new URL(s, typeof window !== 'undefined' ? window.location.origin : 'https://x')
    if (typeof window !== 'undefined' && u.origin !== window.location.origin) return null
    if (!u.pathname.startsWith('/app')) return null
    const id = u.searchParams.get('page')
    return id && pages.some(p => p.id === id) ? id : null
  } catch { return null }
}
