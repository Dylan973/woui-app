-- Woui — passage à Stripe + inscription en libre-service (2026-11-10)
--
-- 1. Colonnes SureCart remplacées par Stripe.
-- 2. Chaque inscription (auth.users) crée automatiquement la fiche praticien,
--    en essai gratuit de 14 jours sur le plan choisi.
-- 3. Le contrôle d'envoi bloque un essai expiré.

-- ─── 1. Stripe ──────────────────────────────────────────────────────────────
alter table public.doctors rename column surecart_customer_id to stripe_customer_id;
alter table public.doctors rename column surecart_subscription_id to stripe_subscription_id;
alter table public.doctors add column if not exists stripe_price_id text;
alter table public.doctors add column if not exists billing_interval text
  check (billing_interval in ('monthly', 'yearly'));

create unique index if not exists idx_doctors_stripe_customer on public.doctors(stripe_customer_id)
  where stripe_customer_id is not null;

-- ─── 2. Fiche praticien créée à l'inscription ───────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  chosen text := coalesce(new.raw_user_meta_data->>'plan', 'pro');
begin
  if chosen not in ('starter', 'pro', 'clinic') then
    chosen := 'pro';
  end if;

  insert into public.doctors (user_id, email, first_name, last_name, plan, plan_status, plan_expires_at)
  values (
    new.id,
    lower(new.email),
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    chosen,
    'trialing',
    now() + interval '14 days'
  )
  on conflict (email) do update
    set user_id = excluded.user_id
    where public.doctors.user_id is null;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 3. Essai expiré = envoi bloqué ─────────────────────────────────────────
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

  lim := case d.plan when 'starter' then 10 when 'pro' then 100 else null end;
  if lim is not null and d.used >= lim then
    raise exception 'Limite mensuelle atteinte (% consentements). Passez au plan supérieur pour continuer.', lim;
  end if;

  return new;
end;
$$;
