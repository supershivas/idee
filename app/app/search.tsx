import { normalizeStr } from './utils'

// Parse Tiptap JSON → texte brut (stack iterative, compatible ES5 target).
// Partagé par la recherche desktop (SearchBar) et mobile (MobileSearchOverlay,
// TagsView) pour que les deux extraient le texte des notes de la même façon.
export function tiptapToText(content: string): string {
  if (!content) return ''
  var doc: any = null
  try { doc = JSON.parse(content) } catch (_e) {
    return content.replace(/<[^>]+>/g, ' ')
  }
  var parts: string[] = []
  var stack: any[] = [doc]
  while (stack.length > 0) {
    var node = stack.pop()
    if (!node) continue
    if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text)
    if (Array.isArray(node.content)) {
      for (var i = node.content.length - 1; i >= 0; i--) {
        stack.push(node.content[i])
      }
    }
  }
  return parts.join(' ')
}

// Correspondance insensible aux accents et à la casse (titre + corps) — la
// version desktop normalisait les accents, la version mobile non
// (« cafe » trouvait « café » sur desktop seulement).
export function matchesQuery(title: string, body: string, query: string): boolean {
  const q = normalizeStr(query)
  return normalizeStr(title).includes(q) || normalizeStr(body).includes(q)
}

// Extrait de texte autour de la première occurrence de la requête. Fenêtre
// de contexte paramétrable : desktop et mobile n'affichent pas la même
// largeur (35/70 sur mobile vs 40/80 sur desktop, tel quel avant ce
// regroupement).
export function getSnippet(text: string, query: string, before = 40, after = 80): string | null {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - before)
  const end = Math.min(text.length, idx + query.length + after)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

export function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}
