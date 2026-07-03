-- SuiviTV — schéma initial
-- Suivi de visionnage séries (épisode par épisode) + films, à la TV Time.

-- =========================================================================
-- Profils
-- =========================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Création automatique du profil à l'inscription
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- Séries suivies
-- =========================================================================
create table public.tracked_shows (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  name text not null,
  poster_path text,
  backdrop_path text,
  status text not null default 'watching'
    check (status in ('watching', 'completed', 'stopped', 'planned')),
  rating smallint check (rating between 1 and 10),
  added_at timestamptz not null default now(),
  unique (user_id, tmdb_id)
);

create index tracked_shows_user_idx on public.tracked_shows (user_id);

alter table public.tracked_shows enable row level security;

create policy "tracked_shows_select_own" on public.tracked_shows
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "tracked_shows_insert_own" on public.tracked_shows
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tracked_shows_update_own" on public.tracked_shows
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tracked_shows_delete_own" on public.tracked_shows
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- Épisodes vus
-- =========================================================================
create table public.watched_episodes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tmdb_show_id integer not null,
  season_number smallint not null check (season_number >= 0),
  episode_number smallint not null check (episode_number >= 1),
  watched_at timestamptz not null default now(),
  unique (user_id, tmdb_show_id, season_number, episode_number)
);

create index watched_episodes_user_show_idx
  on public.watched_episodes (user_id, tmdb_show_id);

alter table public.watched_episodes enable row level security;

create policy "watched_episodes_select_own" on public.watched_episodes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "watched_episodes_insert_own" on public.watched_episodes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "watched_episodes_update_own" on public.watched_episodes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "watched_episodes_delete_own" on public.watched_episodes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- Films (watchlist + vus)
-- =========================================================================
create table public.user_movies (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  title text not null,
  poster_path text,
  status text not null default 'watchlist'
    check (status in ('watchlist', 'watched')),
  rating smallint check (rating between 1 and 10),
  watched_at timestamptz,
  added_at timestamptz not null default now(),
  unique (user_id, tmdb_id)
);

create index user_movies_user_idx on public.user_movies (user_id);

alter table public.user_movies enable row level security;

create policy "user_movies_select_own" on public.user_movies
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_movies_insert_own" on public.user_movies
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_movies_update_own" on public.user_movies
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_movies_delete_own" on public.user_movies
  for delete to authenticated
  using ((select auth.uid()) = user_id);
