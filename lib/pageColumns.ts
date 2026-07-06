// Toutes les colonnes de `pages` SAUF `content` : le corps des notes
// (potentiellement plusieurs Mo cumulés) n'est pas chargé au premier rendu.
// Il est hydraté en arrière-plan côté client (voir App.tsx). Seul le contenu
// de la page ouverte via l'URL est renvoyé d'emblée par le serveur.
export const PAGE_META_COLUMNS =
  'id, parent_id, title, icon, tags, favorite, favorite_position, type, position, created_at, updated_at, deleted_at, summary, cover_url, is_shared, share_token, comments_enabled'
