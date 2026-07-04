-- Association d'appareils (Kodi) par code OTP.
-- La table n'est jamais accessible directement : uniquement via les deux
-- fonctions RPC (côté appareil, rôle anon) et l'Edge Function pair-device
-- (service role) qui dépose le jeton à usage unique.

create table public.device_links (
  code text primary key,
  created_at timestamptz not null default now(),
  claimed boolean not null default false,
  token_hash text,
  payload jsonb
);

alter table public.device_links enable row level security;
-- Aucune policy : anon/authenticated ne touchent la table qu'à travers les RPC.
revoke all on table public.device_links from anon, authenticated;

-- L'appareil demande un code d'association (valable 10 minutes).
create function public.create_device_link()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
begin
  delete from public.device_links
  where created_at < now() - interval '10 minutes';

  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.device_links (code) values (new_code);
  return new_code;
end;
$$;

-- L'appareil vient chercher le résultat ; le code est détruit à la lecture.
create function public.poll_device_link(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.device_links%rowtype;
begin
  select * into link
  from public.device_links
  where code = upper(trim(p_code));

  if link.code is null or not link.claimed then
    return null;
  end if;

  delete from public.device_links where code = link.code;
  return jsonb_build_object('token_hash', link.token_hash, 'payload', link.payload);
end;
$$;

revoke execute on function public.create_device_link() from public, authenticated;
revoke execute on function public.poll_device_link(text) from public, authenticated;
grant execute on function public.create_device_link() to anon;
grant execute on function public.poll_device_link(text) to anon;
