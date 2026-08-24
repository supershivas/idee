-- Suppression définitive automatique des pages en corbeille depuis plus de
-- 30 jours (le compte à rebours est déjà affiché dans TrashPanel, mais rien
-- ne l'appliquait). Nettoie aussi les lignes dépendantes (commentaires,
-- historique) au cas où elles ne seraient pas déjà en ON DELETE CASCADE.
create or replace function public.purge_old_trash()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  purge_ids uuid[];
begin
  select array_agg(id) into purge_ids
  from public.pages
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';

  if purge_ids is null then
    return;
  end if;

  delete from public.page_comments where page_id = any(purge_ids);
  delete from public.page_history where page_id = any(purge_ids);
  delete from public.pages where id = any(purge_ids);
end;
$$;

-- Programme l'exécution quotidienne. Nécessite l'extension pg_cron — sur la
-- plupart des projets Supabase elle peut être activée directement en SQL,
-- mais si la commande ci-dessous échoue (permissions), l'activer d'abord
-- depuis le dashboard : Database → Extensions → pg_cron, puis ne relancer
-- que le bloc "select cron.schedule(...)" qui suit.
create extension if not exists pg_cron;

select cron.schedule(
  'purge-old-trash',
  '0 3 * * *', -- tous les jours à 3h UTC
  $$ select public.purge_old_trash(); $$
);
