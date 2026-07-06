-- Rate-limit partagé pour /api/summarize (et autres endpoints à l'avenir).
--
-- Le limiteur in-memory précédent était inopérant sur Vercel : chaque
-- instance serverless a sa propre Map, remise à zéro à chaque cold start.
-- On centralise donc le compteur dans Postgres via une fonction atomique.
--
-- À exécuter une fois dans le SQL Editor du projet Supabase.

create table if not exists public.rate_limits (
  bucket       text primary key,
  count        integer     not null default 0,
  window_start timestamptz not null default now()
);

-- Aucune policy RLS → aucun accès direct depuis les clients (anon /
-- authenticated). Seule la fonction SECURITY DEFINER ci-dessous y touche.
alter table public.rate_limits enable row level security;

-- Fenêtre fixe atomique : incrémente le compteur du bucket, le réinitialise
-- si la fenêtre est expirée, et renvoie true tant que la limite n'est pas
-- dépassée. Le tout en un seul UPSERT → pas de course entre instances.
create or replace function public.check_rate_limit(
  p_bucket         text,
  p_max            integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as rl (bucket, count, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update set
    count = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else rl.count + 1
    end,
    window_start = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else rl.window_start
    end
  returning rl.count into v_count;

  return v_count <= p_max;
end;
$$;

grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;
