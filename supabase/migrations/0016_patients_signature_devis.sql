-- Fiches patients et signature du devis séparée de celle du consentement.
--
-- • patients : une fiche par patient et par compte (nom et prénom + date de naissance).
--   Chaque envoi est rattaché à la fiche ; les envois d'un même patient sont regroupés.
-- • Signature : le devis et le consentement se signent séparément.
--   Devis : le patient l'ouvre, coche « prêt à planifier les rendez-vous » et signe.
--   Consentement : il regarde la vidéo puis signe.
--   L'envoi passe à « signé » quand toutes ses parties le sont.

-- ── Fiches patients ──────────────────────────────────────────────────────────
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  full_name text not null check (length(full_name) between 1 and 160),
  birth_date date check (birth_date is null or (birth_date > date '1900-01-01' and birth_date <= current_date)),
  email text check (email is null or length(email) <= 320),
  phone text check (phone is null or length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists patients_identity_idx
  on public.patients (doctor_id, lower(full_name), coalesce(birth_date, date '1900-01-01'));
create index if not exists patients_doctor_idx on public.patients (doctor_id, full_name);

alter table public.patients enable row level security;
drop policy if exists patients_own on public.patients;
create policy patients_own on public.patients for all
  using (doctor_id in (select id from public.doctors where user_id = (select auth.uid())))
  with check (doctor_id in (select id from public.doctors where user_id = (select auth.uid())));

revoke all on public.patients from anon;
revoke insert, update, delete on public.patients from authenticated;
grant select on public.patients to authenticated;
grant update (full_name, birth_date, email, phone, updated_at) on public.patients to authenticated;

alter table public.consents add column if not exists patient_id uuid references public.patients (id) on delete set null;
alter table public.consents add column if not exists birth_date date;
create index if not exists consents_patient_idx on public.consents (patient_id);
grant insert (birth_date) on public.consents to authenticated;

-- À chaque envoi : fiche du patient retrouvée (même nom et même date de naissance) ou créée,
-- e-mail et téléphone mis à jour.
create or replace function public.link_consent_patient()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.patient := regexp_replace(trim(new.patient), '\s+', ' ', 'g');
  insert into public.patients as p (doctor_id, full_name, birth_date, email, phone)
  values (new.doctor_id, new.patient, new.birth_date, new.email, new.phone)
  on conflict (doctor_id, lower(full_name), coalesce(birth_date, date '1900-01-01'))
  do update set email = excluded.email, phone = coalesce(excluded.phone, p.phone), updated_at = now()
  returning p.id into new.patient_id;
  return new;
end;
$$;

drop trigger if exists consents_link_patient on public.consents;
create trigger consents_link_patient before insert on public.consents
  for each row execute function public.link_consent_patient();

-- Envois existants : une fiche par patient (sans date de naissance).
insert into public.patients (doctor_id, full_name, email, phone, created_at)
select distinct on (c.doctor_id, lower(regexp_replace(trim(c.patient), '\s+', ' ', 'g')))
       c.doctor_id, regexp_replace(trim(c.patient), '\s+', ' ', 'g'), c.email, c.phone, c.created_at
  from public.consents c
 where c.patient_id is null
 order by c.doctor_id, lower(regexp_replace(trim(c.patient), '\s+', ' ', 'g')), c.created_at desc
on conflict do nothing;

update public.consents c
   set patient_id = p.id
  from public.patients p
 where c.patient_id is null
   and p.doctor_id = c.doctor_id
   and lower(p.full_name) = lower(regexp_replace(trim(c.patient), '\s+', ' ', 'g'))
   and p.birth_date is null;

-- ── Signatures séparées ──────────────────────────────────────────────────────
alter table public.consents add column if not exists consent_signed_at timestamptz;
alter table public.consents add column if not exists quote_signature_data text;
alter table public.consents add column if not exists quote_signed_ip text;
alter table public.consents add column if not exists quote_signed_user_agent text;
alter table public.consents add column if not exists quote_ready boolean not null default false;

update public.consents
   set consent_signed_at = signed_at
 where status = 'signed' and kind in ('consent', 'both') and consent_signed_at is null;
update public.consents
   set quote_signature_data = signature_data, quote_ready = true
 where status = 'signed' and kind in ('quote', 'both') and quote_signature_data is null;

drop function if exists public.sign_consent(text, text);

create function public.sign_consent(p_token text, p_signature text, p_part text default 'consent', p_ready boolean default false)
returns setof public.consents
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_signature is null or p_signature not like 'data:image/%' or length(p_signature) >= 1000000 then
    return;
  end if;

  if p_part = 'quote' then
    -- Devis : ouvert, pas encore signé, patient prêt à planifier les rendez-vous.
    return query
    update public.consents
       set quote_signed_at = now(),
           quote_signature_data = p_signature,
           quote_ready = true,
           status = case when kind = 'quote' or consent_signed_at is not null then 'signed' else status end,
           signed_at = case when kind = 'quote' or consent_signed_at is not null then now() else signed_at end
     where token = p_token
       and link_expires_at >= now()
       and kind in ('quote', 'both')
       and quote_signed_at is null
       and quote_opened_at is not null
       and coalesce(p_ready, false)
    returning *;
  elsif p_part = 'consent' then
    -- Consentement : vidéo visionnée, pas encore signé.
    return query
    update public.consents
       set consent_signed_at = now(),
           signature_data = p_signature,
           status = case when kind = 'consent' or quote_signed_at is not null then 'signed' else status end,
           signed_at = case when kind = 'consent' or quote_signed_at is not null then now() else signed_at end
     where token = p_token
       and link_expires_at >= now()
       and kind in ('consent', 'both')
       and consent_signed_at is null
       and status = 'viewed'
    returning *;
  end if;
end;
$$;

revoke execute on function public.sign_consent(text, text, text, boolean) from public, anon, authenticated;

-- ── Vue patient : état de chaque signature ───────────────────────────────────
drop function if exists public.get_consent_by_token(text);
drop function if exists public.mark_consent_opened(text);
drop function if exists public.mark_consent_viewed(text);
drop function if exists public.patient_view(text);

create function public.patient_view(p_token text)
returns table (
  id uuid, patient text, procedure text, status text, kind text, video_progress int,
  sent_at timestamptz, opened_at timestamptz, viewed_at timestamptz, signed_at timestamptz,
  quote_name text, quote_opened_at timestamptz, has_template boolean, expired boolean,
  cabinet_name text, practitioner_name text, has_logo boolean,
  has_postop boolean, postop_name text, appointment_at timestamptz,
  quote_signed_at timestamptz, consent_signed_at timestamptz
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
         c.appointment_at,
         c.quote_signed_at,
         c.consent_signed_at
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
  has_postop boolean, postop_name text, appointment_at timestamptz,
  quote_signed_at timestamptz, consent_signed_at timestamptz
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
  has_postop boolean, postop_name text, appointment_at timestamptz,
  quote_signed_at timestamptz, consent_signed_at timestamptz
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
  has_postop boolean, postop_name text, appointment_at timestamptz,
  quote_signed_at timestamptz, consent_signed_at timestamptz
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
