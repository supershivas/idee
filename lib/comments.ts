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
