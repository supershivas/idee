export type PageType = 'page' | 'journal'

// État de la sauvegarde différée (contenu + titre) :
// 'pending' = modifications en attente d'envoi, 'saving' = écriture en cours,
// 'error' = échec (nouvel essai automatique), 'saved' = tout est persisté.
export type SaveState = 'saved' | 'pending' | 'saving' | 'error'
export type Page = {
  id: string
  parent_id: string | null
  title: string
  content: string
  icon: string
  tags?: string[]
  favorite?: boolean
  favorite_position?: number | null
  type?: PageType
  position: number
  created_at: string
  updated_at: string
  deleted_at?: string | null
  summary?: string | null
  cover_url?: string | null
  is_shared?: boolean
  share_token?: string | null
  comments_enabled?: boolean
}
export function formatSubtitle(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
export function formatDate(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
