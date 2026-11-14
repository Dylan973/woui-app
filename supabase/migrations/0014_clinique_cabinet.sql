-- Offre Clinique : le compte appartient au cabinet, les dentistes associés y créent leur profil.
--
-- • doctors.account_type : 'practitioner' (Starter, Pro : le compte est celui d'un dentiste)
--   ou 'cabinet' (Clinique : le compte est celui du cabinet, identifié par son SIRET).
-- • Un compte cabinet n'a pas de profil praticien : le profil « main » devient l'espace
--   « Gestion du cabinet » (abonnement, équipe, activité, archive), protégé par un code obligatoire.
-- • Chaque praticien a son RPPS (vérifié dans l'Annuaire Santé), sa fonction et sa signature.
-- • 3 praticiens compris ; chaque praticien en plus est un supplément payant (doctors.extra_seats,
--   tenu à jour par le webhook Stripe).
-- • Sur un compte cabinet, tout envoi est fait au nom d'un praticien.
-- • Les actions sur l'abonnement d'un cabinet exigent une session « Gestion du cabinet » ouverte
--   avec le code (cabinet_sessions), vérifiée par les fonctions Stripe.

alter table public.doctors add column if not exists account_type text not null default 'practitioner';
alter table public.doctors drop constraint if exists doctors_account_type_check;
alter table public.doctors add constraint doctors_account_type_check check (account_type in ('practitioner', 'cabinet'));
alter table public.doctors add column if not exists siret text;
alter table public.doctors drop constraint if exists doctors_siret_check;
alter table public.doctors add constraint doctors_siret_check check (siret is null or siret ~ '^[0-9]{14}$');
alter table public.doctors add column if not exists address text;
alter table public.doctors drop constraint if exists doctors_address_check;
alter table public.doctors add constraint doctors_address_check check (address is null or length(address) <= 240);
alter table public.doctors add column if not exists extra_seats int not null default 0;
grant update (siret, address) on public.doctors to authenticated;

-- ── Praticiens : RPPS et vérification ───────────────────────────────────────
alter table public.practitioners add column if not exists rpps text;
alter table public.practitioners add column if not exists rpps_status text not null default 'unverified';
alter table public.practitioners add column if not exists rpps_checked_at timestamptz;
alter table public.practitioners add column if not exists rpps_identity text;
alter table public.practitioners drop constraint if exists practitioners_rpps_check;
alter table public.practitioners add constraint practitioners_rpps_check check (rpps is null or rpps ~ '^[0-9]{11}$');
alter table public.practitioners drop constraint if exists practitioners_rpps_status_check;
alter table public.practitioners add constraint practitioners_rpps_status_check
  check (rpps_status in ('unverified', 'verified', 'mismatch', 'not_found'));
-- Le RPPS est enregistré par la fonction verify-rpps (jamais directement par le navigateur).

-- ── Limite : 3 praticiens + suppléments ─────────────────────────────────────
create or replace function public.enforce_practitioner_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  d record;
  actifs int;
  places int;
begin
  if tg_op = 'UPDATE' and not (old.archived_at is not null and new.archived_at is null) then
    return new; -- simple modification ou archivage : toujours permis
  end if;

  select plan, plan_status, extra_seats into d from public.doctors where id = new.doctor_id;
  if not found then
    raise exception 'Compte introuvable';
  end if;
  if d.plan <> 'clinic' or d.plan_status not in ('active', 'trialing') then
    raise exception 'Les profils praticiens sont disponibles uniquement avec l''abonnement Clinique.';
  end if;

  places := 3 + greatest(coalesce(d.extra_seats, 0), 0);
  select count(*) into actifs from public.practitioners where doctor_id = new.doctor_id and archived_at is null;
  if actifs >= places then
    raise exception 'Votre offre Clinique comprend % praticiens. Ajoutez un praticien supplémentaire depuis Gestion du cabinet > Équipe.', places;
  end if;
  return new;
end;
$$;

-- ── Envois : toujours au nom d'un praticien sur un compte cabinet ────────────
create or replace function public.enforce_rpps()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  d record;
begin
  select account_type, rpps_status into d from public.doctors where id = new.doctor_id;
  if d.account_type = 'cabinet' then
    if new.practitioner_id is null then
      raise exception 'Choisissez le praticien au nom duquel envoyer ce document.';
    end if;
    if exists (select 1 from public.practitioners where id = new.practitioner_id and rpps_status = 'not_found') then
      raise exception 'Le numéro RPPS de ce praticien est introuvable dans l''Annuaire Santé. Corrigez-le dans son profil pour envoyer des documents.';
    end if;
  elsif d.rpps_status = 'not_found' then
    raise exception 'Votre numéro RPPS est introuvable dans l''Annuaire Santé. Corrigez-le dans Paramètres > Profil pour envoyer des documents.';
  end if;
  return new;
end;
$$;

-- ── Inscription : compte cabinet pour l'offre Clinique ──────────────────────
create or replace function public.siret_valide(p text)
returns boolean
language sql
immutable
as $$
  -- 14 chiffres et clé de Luhn
  select p ~ '^[0-9]{14}$' and (
    select sum(case when (14 - i) % 2 = 1 then case when 2 * d > 9 then 2 * d - 9 else 2 * d end else d end) % 10 = 0
      from (select i, substr(p, i, 1)::int as d from generate_series(1, 14) as i) t
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  chosen text := coalesce(meta->>'plan', 'pro');
  chosen_interval text := coalesce(meta->>'interval', 'monthly');
  given_rpps text := regexp_replace(coalesce(meta->>'rpps', ''), '\s', '', 'g');
  given_siret text := regexp_replace(coalesce(meta->>'siret', ''), '\s', '', 'g');
  kind text;
begin
  if chosen not in ('starter', 'pro', 'clinic') then
    chosen := 'pro';
  end if;
  if chosen_interval not in ('monthly', 'yearly') then
    chosen_interval := 'monthly';
  end if;
  kind := case when chosen = 'clinic' then 'cabinet' else 'practitioner' end;
  if kind = 'cabinet' or given_rpps !~ '^[0-9]{11}$' then
    given_rpps := null;
  end if;
  if kind <> 'cabinet' or not public.siret_valide(given_siret) then
    given_siret := null;
  end if;

  insert into public.doctors (
    user_id, email, first_name, last_name, plan, billing_interval, plan_status, plan_expires_at, rpps,
    account_type, cabinet_name, siret, address, phone, specialty
  )
  values (
    new.id,
    lower(new.email),
    case when kind = 'cabinet' then null else nullif(trim(meta->>'first_name'), '') end,
    case when kind = 'cabinet' then null else nullif(trim(meta->>'last_name'), '') end,
    chosen,
    chosen_interval,
    'incomplete',
    null,
    given_rpps,
    kind,
    left(nullif(trim(meta->>'cabinet_name'), ''), 120),
    given_siret,
    left(nullif(trim(meta->>'address'), ''), 240),
    left(nullif(trim(meta->>'phone'), ''), 30),
    case when kind = 'cabinet' then null else 'Chirurgien-dentiste' end
  )
  on conflict (email) do update
    set user_id = excluded.user_id
    where public.doctors.user_id is null;

  return new;
end;
$$;

-- ── Passage d'un compte de dentiste (Starter/Pro) à l'offre Clinique ─────────
-- Le compte devient celui du cabinet ; le dentiste devient, s'il le souhaite, le premier praticien
-- (nom, fonction, RPPS, signature, photo repris) et ses envois passés lui restent attribués.
create or replace function public.convert_to_cabinet(p_cabinet_name text, p_siret text, p_address text, p_phone text, p_keep_owner boolean)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  d record;
  new_id uuid;
  siret_clean text := regexp_replace(coalesce(p_siret, ''), '\s', '', 'g');
begin
  select * into d from public.doctors where user_id = auth.uid() for update;
  if not found then
    raise exception 'Connexion requise';
  end if;
  if d.plan <> 'clinic' or d.plan_status not in ('active', 'trialing') then
    raise exception 'Disponible avec l''abonnement Clinique.';
  end if;
  if not public.siret_valide(siret_clean) then
    raise exception 'Numéro SIRET invalide (14 chiffres).';
  end if;
  if length(trim(coalesce(p_cabinet_name, ''))) = 0 then
    raise exception 'Indiquez le nom du cabinet.';
  end if;

  if d.account_type = 'practitioner' and p_keep_owner and coalesce(trim(d.last_name), '') <> '' then
    insert into public.practitioners (doctor_id, first_name, last_name, specialty, color, photo_path, signature_path, rpps, rpps_status, rpps_checked_at, rpps_identity)
    values (d.id, coalesce(nullif(trim(d.first_name), ''), '—'), trim(d.last_name), coalesce(nullif(d.specialty, ''), 'Chirurgien-dentiste'), '#6c5ce7',
            d.photo_path,
            case when d.signature_path is not null then d.signature_path end,
            d.rpps, d.rpps_status, d.rpps_checked_at, d.rpps_identity)
    returning id into new_id;
    update public.consents set practitioner_id = new_id where doctor_id = d.id and practitioner_id is null;
  end if;

  update public.doctors
     set account_type = 'cabinet',
         cabinet_name = left(trim(p_cabinet_name), 120),
         siret = siret_clean,
         address = left(nullif(trim(coalesce(p_address, '')), ''), 240),
         phone = coalesce(left(nullif(trim(coalesce(p_phone, '')), ''), 30), phone),
         updated_at = now()
   where id = d.id;
  return new_id;
end;
$$;

-- ── Gestion du cabinet : code obligatoire et session d'administration ────────
create table if not exists public.cabinet_sessions (
  token_hash text primary key,
  doctor_id  uuid not null references public.doctors(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists idx_cabinet_sessions_doctor on public.cabinet_sessions(doctor_id);
alter table public.cabinet_sessions enable row level security;
revoke all on public.cabinet_sessions from anon, authenticated;

-- Ouvre l'espace « Gestion du cabinet » : vérifie le code et remet un jeton valable 12 heures.
-- Réponses : 'no_pin' (code à créer), 'wrong', 'locked', ou 'ok:<jeton>'.
create or replace function public.open_cabinet_session(p_pin text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  did uuid := public.pin_context('main');
  cur record;
  token text;
begin
  select * into cur from public.profile_pins where doctor_id = did and profile_key = 'main' for update;
  if cur.pin_hash is null then
    return 'no_pin';
  end if;
  if cur.locked_until is not null and cur.locked_until > now() then
    return 'locked';
  end if;
  if p_pin is null or crypt(p_pin, cur.pin_hash) <> cur.pin_hash then
    perform public.pin_fail(did, 'main');
    return 'wrong';
  end if;
  update public.profile_pins set failed_attempts = 0, locked_until = null where doctor_id = did and profile_key = 'main';
  delete from public.cabinet_sessions where doctor_id = did and expires_at < now();
  token := encode(gen_random_bytes(24), 'hex');
  insert into public.cabinet_sessions (token_hash, doctor_id, expires_at)
  values (encode(digest(token, 'sha256'), 'hex'), did, now() + interval '12 hours');
  return 'ok:' || token;
end;
$$;

-- Sur un compte cabinet, le code de « Gestion du cabinet » ne peut pas être retiré, seulement changé.
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
  if p_profile = 'main' and exists (select 1 from public.doctors where id = did and account_type = 'cabinet') then
    return 'required';
  end if;
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

revoke execute on function public.enforce_practitioner_rules(), public.enforce_rpps(), public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.siret_valide(text) from public, anon;
grant execute on function public.siret_valide(text) to authenticated;
revoke execute on function public.convert_to_cabinet(text, text, text, text, boolean), public.open_cabinet_session(text) from public, anon;
grant execute on function public.convert_to_cabinet(text, text, text, text, boolean), public.open_cabinet_session(text) to authenticated;
