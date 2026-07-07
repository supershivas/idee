// Sérialisation des commentaires côté API.
//
// RÈGLE : ne JAMAIS renvoyer `author_token` au client. Ce token est la preuve
// de propriété d'un commentaire (il autorise l'édition et la suppression via
// /api/comments/[id]) — l'exposer permettrait à n'importe quel visiteur
// d'usurper les commentaires des autres. À la place, le serveur calcule
// `is_own` / `mine` en comparant au token du demandeur (header x-author-token).

export const COMMENT_COLUMNS =
  'id, page_id, parent_id, author_name, content, selected_text, created_at, edited_at, resolved, pinned, author_token, reactions:page_comment_reactions(emoji, author_token)'

type RawReaction = { emoji: string; author_token: string | null }

export type RawComment = {
  author_token: string | null
  reactions?: RawReaction[] | null
  [key: string]: unknown
}

export function sanitizeComment(row: RawComment, requesterToken?: string | null) {
  const { author_token, reactions, ...rest } = row
  return {
    ...rest,
    is_own: !!requesterToken && author_token === requesterToken,
    reactions: (reactions || []).map(r => ({
      emoji: r.emoji,
      mine: !!requesterToken && r.author_token === requesterToken,
    })),
  }
}

// Diffuse un événement commentaire à tous les visiteurs de la page partagée,
// via un canal Supabase Broadcast (et NON postgres_changes, qui exposerait
// author_token). Le payload doit déjà être assaini (sanitizeComment sans
// token → is_own/mine à false ; chaque client garde sa propre propriété via
// ses maj optimistes). Émission depuis le serveur par l'endpoint REST
// Realtime : stateless, pas de WebSocket par requête. Fire-and-forget —
// un échec de diffusion ne doit pas faire échouer l'écriture principale.
export async function broadcastCommentEvent(
  pageId: string,
  event: 'insert' | 'update' | 'delete',
  payload: unknown
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic: `comments:${pageId}`, event, payload }] }),
    })
  } catch (err) {
    console.error('broadcastCommentEvent failed:', err)
  }
}
