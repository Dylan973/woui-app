-- Offre Pro : 200 envois par mois (un envoi = consentement, devis et/ou conseils post-opératoires ; les relances ne comptent pas).
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

  lim := case d.plan when 'starter' then 10 when 'pro' then 200 else null end;
  if lim is not null and d.used >= lim then
    raise exception 'Limite mensuelle atteinte (% envois). Passez au plan supérieur pour continuer.', lim;
  end if;

  return new;
end;
$$;
