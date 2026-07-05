-- Listes personnalisées (fonctionnalité Pro côté app ; le schéma reste
-- neutre — le gating est applicatif, pas en base).

create table public.user_lists (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  emoji text check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index user_lists_user_idx on public.user_lists (user_id);

alter table public.user_lists enable row level security;

create policy "user_lists_select_own" on public.user_lists
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_lists_insert_own" on public.user_lists
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_lists_update_own" on public.user_lists
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_lists_delete_own" on public.user_lists
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Éléments d'une liste : série OU film, identifié par (media_type, tmdb_id).
-- On dénormalise titre/affiche pour rendre les listes sans requêtes TMDB.

create table public.list_items (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_id bigint not null references public.user_lists (id) on delete cascade,
  media_type text not null check (media_type in ('show', 'movie')),
  tmdb_id integer not null,
  title text not null,
  poster_path text,
  added_at timestamptz not null default now(),
  unique (list_id, media_type, tmdb_id)
);

create index list_items_list_idx on public.list_items (list_id);
create index list_items_user_idx on public.list_items (user_id);

alter table public.list_items enable row level security;

create policy "list_items_select_own" on public.list_items
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "list_items_insert_own" on public.list_items
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.user_id = (select auth.uid())
    )
  );

create policy "list_items_delete_own" on public.list_items
  for delete to authenticated
  using ((select auth.uid()) = user_id);
