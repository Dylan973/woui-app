-- Photo de profil et code à 4 chiffres (facultatif) par profil.
--
-- Photo : stockage privé `avatars/<doctor_id>/…`, lisible et modifiable par le compte uniquement.
-- Code  : jamais lisible depuis le navigateur. Il est haché (bcrypt) dans profile_pins et
--         tout passe par des fonctions : création, modification avec l'ancien code,
--         vérification (5 essais puis blocage 5 minutes), réinitialisation par e-mail.
--         Le code évite qu'un collègue ouvre le profil d'un autre sur un poste partagé ;
--         il ne remplace pas le mot de passe du compte.

-- ── Photo ────────────────────────────────────────────────────────────────────
alter table public.doctors add column if not exists photo_path text;
alter table public.practitioners add column if not exists photo_path text;

alter table public.doctors drop constraint if exists doctors_photo_path_check;
alter table public.doctors add constraint doctors_photo_path_check
  check (photo_path is null or photo_path like id::text || '/%');
alter table public.practitioners drop constraint if exists practitioners_photo_path_check;
alter table public.practitioners add constraint practitioners_photo_path_check
  check (photo_path is null or photo_path like doctor_id::text || '/%');

grant update (photo_path) on public.doctors to authenticated;
grant update (photo_path) on public.practitioners to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists avatars_compte on storage.objects;
create policy avatars_compte on storage.objects
  for all to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] in (select id::text from public.doctors where user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] in (select id::text from public.doctors where user_id = (select auth.uid()))
  );

-- ── Code de profil ───────────────────────────────────────────────────────────
create table if not exists public.profile_pins (
  doctor_id       uuid not null references public.doctors(id) on delete cascade,
  profile_key     text not null, -- 'main' (titulaire) ou l'id du profil praticien
  pin_hash        text,
  offered_at      timestamptz,   -- la proposition « créer un code ? » a déjà été faite
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (doctor_id, profile_key)
);

create table if not exists public.profile_pin_resets (
  token_hash  text primary key,
  doctor_id   uuid not null references public.doctors(id) on delete cascade,
  profile_key text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.profile_pins enable row level security;
alter table public.profile_pin_resets enable row level security;
revoke all on public.profile_pins, public.profile_pin_resets from anon, authenticated;

-- Compte de l'utilisateur connecté + contrôle que le profil lui appartient.
create or replace function public.pin_context(p_profile text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  did uuid;
begin
  select id into did from public.doctors where user_id = auth.uid();
  if did is null then
    raise exception 'Connexion requise';
  end if;
  if p_profile is distinct from 'main'
     and not exists (select 1 from public.practitioners where id::text = p_profile and doctor_id = did) then
    raise exception 'Profil introuvable';
  end if;
  return did;
end;
$$;

-- Essai raté : 5 erreurs de suite bloquent le profil 5 minutes.
create or replace function public.pin_fail(p_doctor uuid, p_profile text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.profile_pins
     set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
         locked_until = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' else locked_until end,
         updated_at = now()
   where doctor_id = p_doctor and profile_key = p_profile;
$$;

create or replace function public.profile_pin_status()
returns table (profile_key text, has_pin boolean, offered boolean, locked_until timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.profile_key, p.pin_hash is not null, p.offered_at is not null, p.locked_until
    from public.profile_pins p
   where p.doctor_id = (select id from public.doctors where user_id = auth.uid());
$$;

create or replace function public.mark_pin_offered(p_profile text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  did uuid := public.pin_context(p_profile);
begin
  insert into public.profile_pins (doctor_id, profile_key, offered_at)
  values (did, p_profile, now())
  on conflict (doctor_id, profile_key) do update set offered_at = coalesce(public.profile_pins.offered_at, now());
end;
$$;

-- Crée le code, ou le modifie si l'ancien code est fourni et exact.
create or replace function public.set_profile_pin(p_profile text, p_pin text, p_old text default null)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  did uuid := public.pin_context(p_profile);
  d record;
  cur record;
begin
  select plan, plan_status into d from public.doctors where id = did;
  if d.plan not in ('pro', 'clinic') or d.plan_status not in ('active', 'trialing') then
    raise exception 'Le code de profil est disponible avec les abonnements Pro et Clinique.';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return 'invalid';
  end if;

  select * into cur from public.profile_pins where doctor_id = did and profile_key = p_profile for update;
  if cur.pin_hash is not null then
    if cur.locked_until is not null and cur.locked_until > now() then
      return 'locked';
    end if;
    if p_old is null or crypt(p_old, cur.pin_hash) <> cur.pin_hash then
      perform public.pin_fail(did, p_profile);
      return 'wrong_old';
    end if;
  end if;

  insert into public.profile_pins (doctor_id, profile_key, pin_hash, offered_at)
  values (did, p_profile, crypt(p_pin, gen_salt('bf', 8)), now())
  on conflict (doctor_id, profile_key) do update
    set pin_hash = excluded.pin_hash,
        offered_at = coalesce(public.profile_pins.offered_at, now()),
        failed_attempts = 0,
        locked_until = null,
        updated_at = now();
  return 'ok';
end;
$$;

create or replace function public.remove_profile_pin(p_profile text, p_old text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  did uuid := public.pin_context(p_profile);
  cur record;
begin
  select * into cur from public.profile_pins where doctor_id = did and profile_key = p_profile for update;
  if cur.pin_hash is null then
    return 'ok';
  end if;
  if cur.locked_until is not null and cur.locked_until > now() then
    return 'locked';
  end if;
  if p_old is null or crypt(p_old, cur.pin_hash) <> cur.pin_hash then
    perform public.pin_fail(did, p_profile);
    return 'wrong_old';
  end if;
  update public.profile_pins
     set pin_hash = null, failed_attempts = 0, locked_until = null, updated_at = now()
   where doctor_id = did and profile_key = p_profile;
  return 'ok';
end;
$$;

create or replace function public.verify_profile_pin(p_profile text, p_pin text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  did uuid := public.pin_context(p_profile);
  cur record;
begin
  select * into cur from public.profile_pins where doctor_id = did and profile_key = p_profile for update;
  if cur.pin_hash is null then
    return 'ok'; -- aucun code sur ce profil
  end if;
  if cur.locked_until is not null and cur.locked_until > now() then
    return 'locked';
  end if;
  if p_pin is null or crypt(p_pin, cur.pin_hash) <> cur.pin_hash then
    perform public.pin_fail(did, p_profile);
    return 'wrong';
  end if;
  update public.profile_pins set failed_attempts = 0, locked_until = null where doctor_id = did and profile_key = p_profile;
  return 'ok';
end;
$$;

-- Lien reçu par e-mail : supprime le code du profil (un nouveau se crée dans Paramètres > Sécurité).
create or replace function public.reset_profile_pin(p_token text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  did uuid;
  r record;
begin
  select id into did from public.doctors where user_id = auth.uid();
  if did is null then
    raise exception 'Connexion requise';
  end if;
  select * into r
    from public.profile_pin_resets
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     and doctor_id = did
     and expires_at > now();
  if not found then
    return null;
  end if;
  update public.profile_pins
     set pin_hash = null, failed_attempts = 0, locked_until = null, updated_at = now()
   where doctor_id = did and profile_key = r.profile_key;
  delete from public.profile_pin_resets where doctor_id = did and profile_key = r.profile_key;
  return r.profile_key;
end;
$$;

revoke execute on function
  public.pin_context(text),
  public.pin_fail(uuid, text),
  public.profile_pin_status(),
  public.mark_pin_offered(text),
  public.set_profile_pin(text, text, text),
  public.remove_profile_pin(text, text),
  public.verify_profile_pin(text, text),
  public.reset_profile_pin(text)
from public, anon, authenticated;

grant execute on function
  public.profile_pin_status(),
  public.mark_pin_offered(text),
  public.set_profile_pin(text, text, text),
  public.remove_profile_pin(text, text),
  public.verify_profile_pin(text, text),
  public.reset_profile_pin(text)
to authenticated;
