-- Corrections de l'audit + identité du cabinet.
--
-- • Liens patients : valables 30 jours (prolongés à chaque relance). Un lien expiré ne permet
--   plus de regarder ni de signer ; un document déjà signé reste téléchargeable.
-- • Relances : 10 minutes minimum entre deux envois au même patient (contrôlé par send-consent).
-- • Page patient : les fonctions par jeton ne renvoient plus que ce que la page affiche
--   (plus d'adresse IP, d'appareil, d'e-mail ni d'image de signature).
-- • Identité du cabinet : nom (toutes les offres) et logo (offre Clinique), affichés sur la
--   page patient, l'e-mail et le PDF signé.

alter table public.consents add column if not exists link_expires_at timestamptz;
alter table public.consents alter column link_expires_at set default (now() + interval '30 days');
update public.consents set link_expires_at = now() + interval '30 days' where link_expires_at is null;
alter table public.consents alter column link_expires_at set not null;
alter table public.consents add column if not exists last_sent_at timestamptz;

alter table public.doctors add column if not exists cabinet_name text;
alter table public.doctors add column if not exists logo_path text;
alter table public.doctors drop constraint if exists doctors_cabinet_name_check;
alter table public.doctors add constraint doctors_cabinet_name_check check (cabinet_name is null or length(cabinet_name) <= 120);
alter table public.doctors drop constraint if exists doctors_logo_path_check;
alter table public.doctors add constraint doctors_logo_path_check check (logo_path is null or logo_path like id::text || '/logo/%');
grant update (cabinet_name, logo_path) on public.doctors to authenticated;

-- ── Vue patient (ce que la page /sign/:token affiche, rien de plus) ─────────
drop function if exists public.get_consent_by_token(text);
drop function if exists public.mark_consent_opened(text);
drop function if exists public.mark_consent_viewed(text);

-- Fonction interne : la ligne telle que la page patient la voit.
create or replace function public.patient_view(p_token text)
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
  has_logo boolean
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
         d.logo_path is not null and d.plan = 'clinic'
    from public.consents c
    join public.doctors d on d.id = c.doctor_id
    left join public.practitioners p on p.id = c.practitioner_id
   where c.token = p_token
   limit 1;
$$;

create or replace function public.get_consent_by_token(p_token text)
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
  has_logo boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select * from public.patient_view(p_token);
$$;

create or replace function public.mark_consent_opened(p_token text)
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
  has_logo boolean
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

create or replace function public.mark_consent_viewed(p_token text)
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
  has_logo boolean
)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  update public.consents
     set status = 'viewed', viewed_at = coalesce(viewed_at, now()), video_progress = greatest(video_progress, 100)
   where token = p_token and status in ('sent', 'opened') and link_expires_at >= now();
  return query select * from public.patient_view(p_token);
end;
$$;

create or replace function public.update_consent_video_progress(p_token text, p_progress integer)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.consents
     set video_progress = greatest(0, least(100, p_progress))
   where token = p_token
     and status in ('sent', 'opened', 'viewed')
     and link_expires_at >= now();
$$;

-- Signature : refusée sur un lien expiré.
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
     and link_expires_at >= now()
     and p_signature like 'data:image/%'
     and length(p_signature) < 1000000
     and (
       (kind = 'consent' and status = 'viewed')
       or (kind = 'both' and status = 'viewed' and quote_opened_at is not null)
       or (kind = 'quote' and status in ('sent', 'opened') and quote_opened_at is not null)
     )
  returning *;
$$;

revoke execute on function public.patient_view(text) from public, anon, authenticated;
revoke execute on function public.sign_consent(text, text) from public, anon, authenticated;
revoke execute on function public.get_consent_by_token(text), public.mark_consent_opened(text),
  public.mark_consent_viewed(text), public.update_consent_video_progress(text, integer) from public;
grant execute on function public.get_consent_by_token(text), public.mark_consent_opened(text),
  public.mark_consent_viewed(text), public.update_consent_video_progress(text, integer) to anon, authenticated;
