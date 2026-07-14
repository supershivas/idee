-- Colonne « pleine largeur » par note (toggle dans le menu ⋯ du header).
-- Élargit la note (texte + tableaux) à la largeur du panneau, mémorisé par
-- note et synchronisé multi-appareils via Realtime.
--
-- IMPORTANT : appliquer cette migration AVANT de déployer le code qui la
-- consomme — `full_width` est ajouté à la liste des colonnes chargées, donc
-- la requête `pages` échouerait tant que la colonne n'existe pas.

alter table public.pages
  add column if not exists full_width boolean not null default false;
