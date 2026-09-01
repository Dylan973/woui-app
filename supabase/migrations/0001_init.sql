-- Woui — schéma initial (doctors + consents)
-- À exécuter dans Supabase Dashboard → SQL Editor, ou via `supabase db push`.

create extension if not exists pgcrypto;

-- ─── doctors ────────────────────────────────────────────────────────────────
create table if not exists public.doctors (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references auth.users(id) on delete cascade,
  email                    text not null unique,
  first_name               text,
  last_name                text,
  specialty                text default 'Chirurgien-dentiste',
  phone                    text,
  plan                     text not null default 'starter'
                           check (plan in ('starter', 'pro', 'clinic')),
  plan_status              text not null default 'active'
                           check (plan_status in ('active','cancelled','past_due','trialing')),
  surecart_customer_id     text,
  surecart_subscription_id text,
  consents_used_this_month int default 0,
  subscribed_at            timestamptz default now(),
  plan_expires_at          timestamptz,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

alter table public.doctors enable row level security;

drop policy if exists "doctors_own" on public.doctors;
create policy "doctors_own" on public.doctors
  for all using (auth.uid() = user_id);

-- ─── consents ───────────────────────────────────────────────────────────────
create table if not exists public.consents (
  id             uuid primary key default gen_random_uuid(),
  doctor_id      uuid references public.doctors(id) on delete cascade,
  patient        text not null,
  email          text not null,
  procedure      text not null,
  status         text not null default 'sent'
                 check (status in ('sent','opened','viewed','signed')),
  token          text not null unique default gen_random_uuid()::text,
  video_progress int default 0,
  sent_at        timestamptz default now(),
  opened_at      timestamptz,
  viewed_at      timestamptz,
  signed_at      timestamptz,
  signature_data text,
  pdf_url        text,
  created_at     timestamptz default now()
);

alter table public.consents enable row level security;

-- Le praticien voit uniquement ses propres consentements.
drop policy if exists "consents_own_doctor" on public.consents;
create policy "consents_own_doctor" on public.consents
  for all using (
    doctor_id in (
      select id from public.doctors where user_id = auth.uid()
    )
  );

-- Le patient (non authentifié) accède à SON consentement via le token,
-- passé côté client dans la clause WHERE (jamais listé, jamais deviné).
drop policy if exists "consents_patient_read" on public.consents;
create policy "consents_patient_read" on public.consents
  for select using (true);

drop policy if exists "consents_patient_token" on public.consents;
create policy "consents_patient_token" on public.consents
  for update using (true);

-- ─── indexes ────────────────────────────────────────────────────────────────
create index if not exists idx_consents_doctor_id on public.consents(doctor_id);
create index if not exists idx_consents_token on public.consents(token);
create index if not exists idx_doctors_user_id on public.doctors(user_id);

-- ─── realtime ───────────────────────────────────────────────────────────────
-- Nécessaire pour que useConsents() reçoive les changements de statut en direct
-- (patient qui ouvre/visionne/signe). À activer aussi via Dashboard → Database → Replication.
alter publication supabase_realtime add table public.consents;
