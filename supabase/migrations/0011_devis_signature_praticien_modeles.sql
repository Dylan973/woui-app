-- Devis à signer, signature/tampon du praticien, consentement du cabinet en PDF.
--
-- • Un envoi peut contenir un consentement, un devis, ou les deux (colonne kind).
-- • Le devis est le PDF produit par le logiciel du cabinet (Logos, Julie…), déposé à l'envoi.
-- • Le cabinet peut déposer son propre formulaire de consentement (PDF) pour chaque acte.
-- • Chaque praticien enregistre sa signature ou son tampon, ajouté aux documents signés.
-- • Stockage privé `documents/<doctor_id>/…` : signature/, modeles/, devis/.
-- • L'envoi de devis est réservé aux offres Pro et Clinique (contrôlé ici, côté base).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf', 'image/png'])
on conflict (id) do nothing;

drop policy if exists documents_compte on storage.objects;
create policy documents_compte on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (select id::text from public.doctors where user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (select id::text from public.doctors where user_id = (select auth.uid()))
  );

-- ── Signature ou tampon du praticien ─────────────────────────────────────────
alter table public.doctors add column if not exists signature_path text;
alter table public.practitioners add column if not exists signature_path text;

alter table public.doctors drop constraint if exists doctors_signature_path_check;
alter table public.doctors add constraint doctors_signature_path_check
  check (signature_path is null or signature_path like id::text || '/signature/%');
alter table public.practitioners drop constraint if exists practitioners_signature_path_check;
alter table public.practitioners add constraint practitioners_signature_path_check
  check (signature_path is null or signature_path like doctor_id::text || '/signature/%');

grant update (signature_path) on public.doctors to authenticated;
grant update (signature_path) on public.practitioners to authenticated;

-- ── Formulaires de consentement du cabinet (un PDF par acte) ─────────────────
create table if not exists public.consent_templates (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public.doctors(id) on delete cascade,
  procedure  text not null check (length(procedure) between 1 and 160),
  file_path  text not null,
  file_name  text not null check (length(file_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, procedure),
  check (file_path like doctor_id::text || '/modeles/%')
);

alter table public.consent_templates enable row level security;

drop policy if exists consent_templates_own on public.consent_templates;
create policy consent_templates_own on public.consent_templates
  for all to authenticated
  using (doctor_id in (select id from public.doctors where user_id = (select auth.uid())))
  with check (doctor_id in (select id from public.doctors where user_id = (select auth.uid())));

revoke all on public.consent_templates from anon, authenticated;
grant select, delete on public.consent_templates to authenticated;
grant insert (doctor_id, procedure, file_path, file_name) on public.consent_templates to authenticated;
grant update (file_path, file_name, updated_at) on public.consent_templates to authenticated;

-- ── Envois : consentement, devis, ou les deux ────────────────────────────────
alter table public.consents add column if not exists kind text not null default 'consent';
alter table public.consents drop constraint if exists consents_kind_check;
alter table public.consents add constraint consents_kind_check check (kind in ('consent', 'quote', 'both'));

alter table public.consents add column if not exists template_path text;      -- formulaire du cabinet utilisé
alter table public.consents add column if not exists quote_path text;         -- devis déposé (PDF d'origine)
alter table public.consents add column if not exists quote_name text;
alter table public.consents add column if not exists quote_opened_at timestamptz;
alter table public.consents add column if not exists quote_signed_at timestamptz;
alter table public.consents add column if not exists quote_pdf_url text;      -- devis signé (stockage `consents`)
alter table public.consents add column if not exists quote_hash text;

grant insert (kind, quote_path, quote_name) on public.consents to authenticated;

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

  -- Devis : offres Pro et Clinique, avec un PDF déposé dans le dossier du compte.
  if new.kind in ('quote', 'both') then
    if d.plan not in ('pro', 'clinic') then
      raise exception 'L''envoi de devis est disponible avec les abonnements Pro et Clinique.';
    end if;
    if new.quote_path is null or new.quote_path not like new.doctor_id::text || '/devis/%' then
      raise exception 'Ajoutez le devis au format PDF.';
    end if;
  else
    new.quote_path := null;
    new.quote_name := null;
  end if;

  -- Consentement : on retient le formulaire du cabinet prévu pour cet acte, s'il existe.
  new.template_path := null;
  if new.kind in ('consent', 'both') then
    select file_path into new.template_path
      from public.consent_templates
     where doctor_id = new.doctor_id and procedure = new.procedure;
  end if;

  lim := case d.plan when 'starter' then 10 when 'pro' then 100 else null end;
  if lim is not null and d.used >= lim then
    raise exception 'Limite mensuelle atteinte (% consentements). Passez au plan supérieur pour continuer.', lim;
  end if;

  return new;
end;
$$;

-- Signature du patient : une seule validation pour les documents de l'envoi.
-- Consentement : la vidéo doit avoir été visionnée. Devis : il doit avoir été ouvert.
create or replace function public.sign_consent(p_token text, p_signature text)
returns setof public.consents
language sql
security definer
set search_path to 'public'
as $$
  update public.consents
     set status = 'signed',
         signed_at = now(),
         signature_data = p_signature,
         quote_signed_at = case when kind in ('quote', 'both') then now() else null end
   where token = p_token
     and p_signature like 'data:image/%'
     and length(p_signature) < 1000000
     and (
       (kind = 'consent' and status = 'viewed')
       or (kind = 'both' and status = 'viewed' and quote_opened_at is not null)
       or (kind = 'quote' and status in ('sent', 'opened') and quote_opened_at is not null)
     )
  returning *;
$$;

revoke execute on function public.enforce_consent_quota() from public, anon, authenticated;
revoke execute on function public.sign_consent(text, text) from public, anon, authenticated;
