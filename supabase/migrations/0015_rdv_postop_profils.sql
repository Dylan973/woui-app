-- Rendez-vous, téléphone du patient, conseils post-opératoires et profils par offre.
--
-- • Envoi : date du rendez-vous (facultative) et téléphone du patient.
--   Le tableau de bord alerte quand rien n'est signé à 2 jours du rendez-vous.
-- • Conseils post-opératoires : PDF remis au patient (rien à signer). Il peut accompagner
--   un consentement et/ou un devis, ou partir seul (kind = 'postop').
--   Le cabinet peut déposer un modèle par acte (consent_templates.category = 'postop').
-- • Profils praticiens : Starter 1 (le titulaire), Pro 2 (titulaire + 1 praticien),
--   Clinique 4 praticiens compris + places supplémentaires payantes.

-- ── Envois ───────────────────────────────────────────────────────────────────
alter table public.consents add column if not exists appointment_at timestamptz;
alter table public.consents add column if not exists phone text;
alter table public.consents add column if not exists with_postop boolean not null default false;
alter table public.consents add column if not exists postop_path text;
alter table public.consents add column if not exists postop_name text;
alter table public.consents add column if not exists postop_opened_at timestamptz;

alter table public.consents drop constraint if exists consents_phone_check;
alter table public.consents add constraint consents_phone_check check (phone is null or phone ~ '^\+?[0-9 .()-]{6,24}$');
alter table public.consents drop constraint if exists consents_postop_name_check;
alter table public.consents add constraint consents_postop_name_check check (postop_name is null or length(postop_name) <= 200);

alter table public.consents drop constraint if exists consents_kind_check;
alter table public.consents add constraint consents_kind_check check (kind in ('consent', 'quote', 'both', 'postop'));

grant insert (appointment_at, phone, with_postop, postop_path, postop_name) on public.consents to authenticated;
grant update (appointment_at, phone) on public.consents to authenticated;

create index if not exists consents_appointment_idx on public.consents (doctor_id, appointment_at) where appointment_at is not null;

-- ── Modèles du cabinet : consentement ou conseils post-opératoires, par acte ──
alter table public.consent_templates add column if not exists category text not null default 'consent';
alter table public.consent_templates drop constraint if exists consent_templates_category_check;
alter table public.consent_templates add constraint consent_templates_category_check check (category in ('consent', 'postop'));
alter table public.consent_templates drop constraint if exists consent_templates_doctor_id_procedure_key;
alter table public.consent_templates drop constraint if exists consent_templates_doctor_category_procedure_key;
alter table public.consent_templates add constraint consent_templates_doctor_category_procedure_key unique (doctor_id, category, procedure);
grant insert (category) on public.consent_templates to authenticated;

-- ── Contrôles à l'envoi ──────────────────────────────────────────────────────
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
    if d.plan not in ('pro', 'clinic') then
      raise exception 'Les profils praticiens sont disponibles avec les abonnements Pro et Clinique.';
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

  -- Consentement : formulaire du cabinet prévu pour cet acte, s'il existe.
  new.template_path := null;
  if new.kind in ('consent', 'both') then
    select file_path into new.template_path
      from public.consent_templates
     where doctor_id = new.doctor_id and category = 'consent' and procedure = new.procedure;
  end if;

  -- Conseils post-opératoires : PDF déposé à l'envoi, sinon modèle du cabinet pour cet acte.
  if new.kind = 'postop' then
    new.with_postop := true;
  end if;
  if new.with_postop then
    if new.postop_path is not null and new.postop_path not like new.doctor_id::text || '/postop/%' then
      raise exception 'Conseils post-opératoires invalides.';
    end if;
    if new.postop_path is null then
      select file_path, file_name into new.postop_path, new.postop_name
        from public.consent_templates
       where doctor_id = new.doctor_id and category = 'postop' and procedure = new.procedure;
    end if;
    if new.postop_path is null then
      raise exception 'Ajoutez les conseils post-opératoires (PDF) ou déposez un modèle pour cet acte dans Paramètres > Documents.';
    end if;
  else
    new.postop_path := null;
    new.postop_name := null;
  end if;

  lim := case d.plan when 'starter' then 10 when 'pro' then 100 else null end;
  if lim is not null and d.used >= lim then
    raise exception 'Limite mensuelle atteinte (% consentements). Passez au plan supérieur pour continuer.', lim;
  end if;

  return new;
end;
$$;

-- ── Profils praticiens par offre ─────────────────────────────────────────────
-- Profils en plus du titulaire / de « Gestion du cabinet » :
-- Starter 0, Pro 1, Clinique 4 + places supplémentaires.
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
  if d.plan_status not in ('active', 'trialing') then
    raise exception 'Votre abonnement n''est pas actif.';
  end if;
  if d.plan not in ('pro', 'clinic') then
    raise exception 'L''offre Starter comprend un seul profil praticien. Passez à l''offre Pro pour ajouter un praticien.';
  end if;

  places := case d.plan when 'pro' then 1 else 4 + greatest(coalesce(d.extra_seats, 0), 0) end;
  select count(*) into actifs from public.practitioners where doctor_id = new.doctor_id and archived_at is null;
  if actifs >= places then
    if d.plan = 'pro' then
      raise exception 'L''offre Pro comprend 2 profils praticiens. Passez à l''offre Clinique pour en ajouter.';
    end if;
    raise exception 'Votre offre Clinique comprend % praticiens. Ajoutez un praticien supplémentaire depuis Gestion du cabinet > Équipe.', places;
  end if;
  return new;
end;
$$;

-- ── Vue patient : rendez-vous et conseils post-opératoires ───────────────────
drop function if exists public.get_consent_by_token(text);
drop function if exists public.mark_consent_opened(text);
drop function if exists public.mark_consent_viewed(text);
drop function if exists public.patient_view(text);

create function public.patient_view(p_token text)
returns table (
  id uuid,
  patient text,
  procedure text,
  status text,
  kind text,
  video_progress int,
  sent_at timestamptz,
  opened_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  quote_name text,
  quote_opened_at timestamptz,
  has_template boolean,
  expired boolean,
  cabinet_name text,
  practitioner_name text,
  has_logo boolean,
  has_postop boolean,
  postop_name text,
  appointment_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id, c.patient, c.procedure, c.status, c.kind, c.video_progress, c.sent_at, c.opened_at, c.viewed_at,
         c.signed_at, c.quote_name, c.quote_opened_at, c.template_path is not null,
         c.status <> 'signed' and c.link_expires_at < now(),
         d.cabinet_name,
         nullif(trim(concat_ws(' ', coalesce(p.first_name, d.first_name), coalesce(p.last_name, d.last_name))), ''),
         d.logo_path is not null and d.plan = 'clinic',
         c.with_postop and c.postop_path is not null,
         c.postop_name,
         c.appointment_at
    from public.consents c
    join public.doctors d on d.id = c.doctor_id
    left join public.practitioners p on p.id = c.practitioner_id
   where c.token = p_token
   limit 1;
$$;

create function public.get_consent_by_token(p_token text)
returns table (
  id uuid, patient text, procedure text, status text, kind text, video_progress int,
  sent_at timestamptz, opened_at timestamptz, viewed_at timestamptz, signed_at timestamptz,
  quote_name text, quote_opened_at timestamptz, has_template boolean, expired boolean,
  cabinet_name text, practitioner_name text, has_logo boolean,
  has_postop boolean, postop_name text, appointment_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select * from public.patient_view(p_token);
$$;

create function public.mark_consent_opened(p_token text)
returns table (
  id uuid, patient text, procedure text, status text, kind text, video_progress int,
  sent_at timestamptz, opened_at timestamptz, viewed_at timestamptz, signed_at timestamptz,
  quote_name text, quote_opened_at timestamptz, has_template boolean, expired boolean,
  cabinet_name text, practitioner_name text, has_logo boolean,
  has_postop boolean, postop_name text, appointment_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  update public.consents
     set status = 'opened', opened_at = coalesce(opened_at, now())
   where token = p_token and status = 'sent' and link_expires_at >= now();
  return query select * from public.patient_view(p_token);
end;
$$;

create function public.mark_consent_viewed(p_token text)
returns table (
  id uuid, patient text, procedure text, status text, kind text, video_progress int,
  sent_at timestamptz, opened_at timestamptz, viewed_at timestamptz, signed_at timestamptz,
  quote_name text, quote_opened_at timestamptz, has_template boolean, expired boolean,
  cabinet_name text, practitioner_name text, has_logo boolean,
  has_postop boolean, postop_name text, appointment_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  update public.consents
     set status = 'viewed', viewed_at = coalesce(viewed_at, now()), video_progress = greatest(video_progress, 100)
   where token = p_token and status in ('sent', 'opened') and kind in ('consent', 'both') and link_expires_at >= now();
  return query select * from public.patient_view(p_token);
end;
$$;

revoke execute on function public.patient_view(text) from public, anon, authenticated;
revoke execute on function public.get_consent_by_token(text), public.mark_consent_opened(text),
  public.mark_consent_viewed(text) from public;
grant execute on function public.get_consent_by_token(text), public.mark_consent_opened(text),
  public.mark_consent_viewed(text) to anon, authenticated;

-- ── Conseiller de sécurité : chemin de recherche figé ───────────────────────
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'siret_valide') then
    execute 'alter function public.siret_valide(text) set search_path to ''public''';
  end if;
end;
$$;

-- ── Actes renommés (Extraction dentaire → Avulsion dentaire, Traitement de canal → Traitement endodontique) ──
update public.consent_templates
   set procedure = case procedure when 'Extraction dentaire' then 'Avulsion dentaire' else 'Traitement endodontique' end,
       updated_at = now()
 where procedure in ('Extraction dentaire', 'Traitement de canal');
