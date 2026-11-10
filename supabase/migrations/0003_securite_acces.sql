-- Woui — verrouillage des accès (2026-11-10)
--
-- 1. Le patient n'accède plus à la table directement : uniquement via les
--    fonctions RPC par token (get_consent_by_token, mark_consent_opened,
--    update_consent_video_progress, mark_consent_viewed, sign_consent).
-- 2. Le praticien ne peut modifier que ses infos de profil (pas son plan,
--    son statut d'abonnement ni son compteur) et ne peut créer un consentement
--    qu'avec patient / email / acte : statut, signature et dates restent
--    contrôlés par la base.
-- 3. La signature n'est acceptée qu'après visionnage de la vidéo.
-- 4. Quota mensuel et abonnement actif vérifiés côté base à chaque envoi.

-- ─── 1. Accès patient : fin des règles ouvertes à tous ───────────────────────
drop policy if exists "consents_patient_read" on public.consents;
drop policy if exists "consents_patient_token" on public.consents;

revoke all on public.consents from anon;
revoke all on public.doctors from anon;

-- ─── 2. Colonnes modifiables par le praticien ───────────────────────────────
revoke insert, update, delete on public.doctors from authenticated;
grant update (first_name, last_name, specialty, phone, updated_at) on public.doctors to authenticated;

revoke insert, update, delete on public.consents from authenticated;
grant insert (doctor_id, patient, email, procedure) on public.consents to authenticated;

-- Fonctions internes : jamais appelables depuis l'API publique.
revoke execute on function public.increment_doctor_consents() from public, anon, authenticated;
revoke execute on function public.reset_monthly_consents() from public, anon, authenticated;

-- ─── 3. Signature uniquement après visionnage ───────────────────────────────
create or replace function public.sign_consent(p_token text, p_signature text)
returns setof public.consents
language sql
security definer
set search_path to 'public'
as $$
  update public.consents
     set status = 'signed',
         signed_at = now(),
         signature_data = p_signature
   where token = p_token
     and status = 'viewed'
     and p_signature like 'data:image/%'
     and length(p_signature) < 1000000
  returning *;
$$;

-- ─── 4. Quota mensuel + abonnement actif ────────────────────────────────────
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
  select plan, plan_status, coalesce(consents_used_this_month, 0) as used
    into d
    from public.doctors
   where id = new.doctor_id;

  if not found then
    raise exception 'Praticien introuvable';
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

revoke execute on function public.enforce_consent_quota() from public, anon, authenticated;

drop trigger if exists before_consent_insert_quota on public.consents;
create trigger before_consent_insert_quota
  before insert on public.consents
  for each row execute function public.enforce_consent_quota();
