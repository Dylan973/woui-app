-- Profils praticiens (offre Clinique).
-- Un compte Woui = un cabinet. Le titulaire du compte est le profil principal (table doctors).
-- L'offre Clinique permet d'ajouter d'autres praticiens : chacun a son profil, ses envois,
-- et son nom sur les emails et les PDF signés.
-- Un profil ne se supprime pas (ses consentements doivent rester attribués) : il s'archive.

create table if not exists public.practitioners (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.doctors(id) on delete cascade,
  first_name  text not null check (length(trim(first_name)) between 1 and 80),
  last_name   text not null check (length(trim(last_name)) between 1 and 80),
  specialty   text not null default 'Chirurgien-dentiste' check (length(specialty) <= 120),
  color       text not null default '#6c5ce7' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_practitioners_doctor_id on public.practitioners(doctor_id);

alter table public.practitioners enable row level security;

drop policy if exists practitioners_own on public.practitioners;
create policy practitioners_own on public.practitioners
  for all to authenticated
  using (doctor_id in (select id from public.doctors where user_id = (select auth.uid())))
  with check (doctor_id in (select id from public.doctors where user_id = (select auth.uid())));

revoke all on public.practitioners from anon, authenticated;
grant select on public.practitioners to authenticated;
grant insert (doctor_id, first_name, last_name, specialty, color) on public.practitioners to authenticated;
grant update (first_name, last_name, specialty, color, archived_at, updated_at) on public.practitioners to authenticated;

-- Ajouter ou réactiver un profil : réservé à l'offre Clinique en cours, 30 profils actifs au plus.
create or replace function public.enforce_practitioner_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  d record;
  actifs int;
begin
  if tg_op = 'UPDATE' and not (old.archived_at is not null and new.archived_at is null) then
    return new; -- simple modification ou archivage : toujours permis
  end if;

  select plan, plan_status into d from public.doctors where id = new.doctor_id;
  if not found then
    raise exception 'Compte introuvable';
  end if;
  if d.plan <> 'clinic' or d.plan_status not in ('active', 'trialing') then
    raise exception 'Les profils praticiens sont disponibles uniquement avec l''abonnement Clinique.';
  end if;

  select count(*) into actifs from public.practitioners where doctor_id = new.doctor_id and archived_at is null;
  if actifs >= 30 then
    raise exception 'Nombre maximum de profils atteint (30). Contactez le support Woui.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_practitioner_rules() from public, anon, authenticated;

drop trigger if exists before_practitioner_write on public.practitioners;
create trigger before_practitioner_write
  before insert or update on public.practitioners
  for each row execute function public.enforce_practitioner_rules();

-- Chaque consentement peut être rattaché à un profil (null = titulaire du compte).
alter table public.consents
  add column if not exists practitioner_id uuid references public.practitioners(id) on delete restrict;
create index if not exists idx_consents_practitioner_id on public.consents(practitioner_id);
grant insert (practitioner_id) on public.consents to authenticated;

-- Le contrôle avant envoi vérifie aussi le profil choisi.
create or replace function public.enforce_consent_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  d record;
  lim int;
begin
  select plan, plan_status, plan_expires_at, coalesce(consents_used_this_month, 0) as used
    into d
    from public.doctors
   where id = new.doctor_id;

  if not found then
    raise exception 'Praticien introuvable';
  end if;

  if d.plan_status = 'trialing' and d.plan_expires_at is not null and d.plan_expires_at < now() then
    raise exception 'Votre essai gratuit est terminé. Choisissez un plan dans Paramètres > Abonnement pour continuer.';
  end if;

  if d.plan_status not in ('active', 'trialing') then
    raise exception 'Votre abonnement n''est pas actif. Mettez à jour votre paiement dans Paramètres > Abonnement.';
  end if;

  if new.practitioner_id is not null then
    if d.plan <> 'clinic' then
      raise exception 'Les profils praticiens sont disponibles uniquement avec l''abonnement Clinique.';
    end if;
    if not exists (
      select 1 from public.practitioners
       where id = new.practitioner_id and doctor_id = new.doctor_id and archived_at is null
    ) then
      raise exception 'Profil praticien introuvable.';
    end if;
  end if;

  lim := case d.plan when 'starter' then 10 when 'pro' then 100 else null end;
  if lim is not null and d.used >= lim then
    raise exception 'Limite mensuelle atteinte (% consentements). Passez au plan supérieur pour continuer.', lim;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_consent_quota() from public, anon, authenticated;

-- Au passage : règles d'accès évaluées une seule fois par requête (conseil de performance Supabase).
drop policy if exists doctors_own on public.doctors;
create policy doctors_own on public.doctors
  for all using ((select auth.uid()) = user_id);

drop policy if exists consents_own_doctor on public.consents;
create policy consents_own_doctor on public.consents
  for all
  using (doctor_id in (select id from public.doctors where user_id = (select auth.uid())))
  with check (doctor_id in (select id from public.doctors where user_id = (select auth.uid())));
