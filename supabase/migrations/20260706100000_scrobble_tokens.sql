-- Jetons de scrobbling (Plex / Jellyfin / Tautulli) : une URL de webhook
-- secrète par utilisateur. Le jeton identifie l'utilisateur côté Edge
-- Function « scrobble » (qui tourne en service role, sans JWT — les serveurs
-- média n'en envoient pas).

create table public.scrobble_tokens (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.scrobble_tokens enable row level security;

create policy "scrobble_tokens_select_own" on public.scrobble_tokens
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "scrobble_tokens_delete_own" on public.scrobble_tokens
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Génération/rotation côté serveur (jeton aléatoire fort, jamais choisi par
-- le client). Retourne le jeton — affiché une fois dans l'app puis relisible
-- via select (il sert d'URL, pas de secret d'authentification de session).
create function public.create_scrobble_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text;
begin
  new_token := replace(gen_random_uuid()::text, '-', '') ||
               replace(gen_random_uuid()::text, '-', '');
  insert into public.scrobble_tokens (user_id, token)
  values (auth.uid(), new_token)
  on conflict (user_id) do update set token = excluded.token,
                                      created_at = now(),
                                      last_used_at = null;
  return new_token;
end;
$$;

revoke execute on function public.create_scrobble_token() from public, anon;
grant execute on function public.create_scrobble_token() to authenticated;
