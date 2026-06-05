export type PageType = 'page' | 'journal'
export type Page = {
  id: string
  parent_id: string | null
  title: string
  content: string
  icon: string
  tags?: string[]
  favorite?: boolean
  type?: PageType
  position: number
  created_at: string
  updated_at: string
  deleted_at?: string | null
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
