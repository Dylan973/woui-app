-- Numéro RPPS du titulaire du compte, demandé à l'inscription et vérifié dans
-- l'Annuaire Santé (Agence du Numérique en Santé) par la fonction verify-rpps.
-- Le numéro n'est pas imprimé sur les documents signés.
--
-- rpps_status :
--   unverified : pas encore vérifié (ou annuaire indisponible)
--   verified   : le numéro existe et le nom correspond
--   mismatch   : le numéro existe, mais le nom ne correspond pas (à contrôler)
--   not_found  : le numéro n'existe pas dans l'annuaire → envois bloqués

alter table public.doctors add column if not exists rpps text;
alter table public.doctors add column if not exists rpps_status text not null default 'unverified';
alter table public.doctors add column if not exists rpps_checked_at timestamptz;
alter table public.doctors add column if not exists rpps_identity text; -- nom trouvé dans l'annuaire

alter table public.doctors drop constraint if exists doctors_rpps_check;
alter table public.doctors add constraint doctors_rpps_check check (rpps is null or rpps ~ '^[0-9]{11}$');
alter table public.doctors drop constraint if exists doctors_rpps_status_check;
alter table public.doctors add constraint doctors_rpps_status_check
  check (rpps_status in ('unverified', 'verified', 'mismatch', 'not_found'));

-- Le numéro saisi à l'inscription est repris tel quel (11 chiffres), à vérifier ensuite.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  chosen text := coalesce(new.raw_user_meta_data->>'plan', 'pro');
  chosen_interval text := coalesce(new.raw_user_meta_data->>'interval', 'monthly');
  given_rpps text := regexp_replace(coalesce(new.raw_user_meta_data->>'rpps', ''), '\s', '', 'g');
begin
  if chosen not in ('starter', 'pro', 'clinic') then
    chosen := 'pro';
  end if;
  if chosen_interval not in ('monthly', 'yearly') then
    chosen_interval := 'monthly';
  end if;
  if given_rpps !~ '^[0-9]{11}$' then
    given_rpps := null;
  end if;

  insert into public.doctors (user_id, email, first_name, last_name, plan, billing_interval, plan_status, plan_expires_at, rpps)
  values (
    new.id,
    lower(new.email),
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    chosen,
    chosen_interval,
    'incomplete',
    null,
    given_rpps
  )
  on conflict (email) do update
    set user_id = excluded.user_id
    where public.doctors.user_id is null;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Un numéro introuvable dans l'annuaire bloque les envois aux patients.
create or replace function public.enforce_rpps()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (select 1 from public.doctors where id = new.doctor_id and rpps_status = 'not_found') then
    raise exception 'Votre numéro RPPS est introuvable dans l''Annuaire Santé. Corrigez-le dans Paramètres > Profil pour envoyer des documents.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_rpps() from public, anon, authenticated;

drop trigger if exists before_consent_insert_rpps on public.consents;
create trigger before_consent_insert_rpps
  before insert on public.consents
  for each row execute function public.enforce_rpps();
