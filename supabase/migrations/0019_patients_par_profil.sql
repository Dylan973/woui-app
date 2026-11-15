-- Fiches patients séparées par profil praticien.
-- Chaque profil a sa propre base patients : une même personne envoyée par deux praticiens du cabinet
-- a deux fiches, une par praticien. Le titulaire (practitioner_id null) garde la sienne.
-- « Gestion du cabinet » voit toutes les fiches, avec le nom du praticien.

alter table public.patients
  add column if not exists practitioner_id uuid references public.practitioners (id) on delete restrict;

drop index if exists public.patients_identity_idx;
create unique index patients_identity_idx
  on public.patients (
    doctor_id,
    coalesce(practitioner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(full_name),
    coalesce(birth_date, date '1900-01-01')
  );

create or replace function public.link_consent_patient()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.patient := regexp_replace(trim(new.patient), '\s+', ' ', 'g');
  insert into public.patients as p (doctor_id, practitioner_id, full_name, birth_date, email, phone)
  values (new.doctor_id, new.practitioner_id, new.patient, new.birth_date, new.email, new.phone)
  on conflict (
    doctor_id,
    coalesce(practitioner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(full_name),
    coalesce(birth_date, date '1900-01-01')
  )
  do update set email = excluded.email, phone = coalesce(excluded.phone, p.phone), updated_at = now()
  returning p.id into new.patient_id;
  return new;
end;
$$;

-- Fiches existantes : chaque fiche prend le profil de ses envois. Une fiche partagée par
-- plusieurs profils est dédoublée : une copie par profil, et les envois rattachés à la bonne copie.
do $$
declare
  r record;
  new_id uuid;
begin
  for r in
    select distinct p.id as patient_id, c.practitioner_id
      from public.patients p
      join public.consents c on c.patient_id = p.id
  loop
    new_id := null;
    select id into new_id
      from public.patients
     where id = r.patient_id
       and practitioner_id is not distinct from r.practitioner_id;
    if new_id is null then
      -- Première occurrence : la fiche d'origine prend ce profil si elle n'en a pas encore reçu.
      update public.patients
         set practitioner_id = r.practitioner_id
       where id = r.patient_id
         and practitioner_id is null
         and not exists (
           select 1 from public.consents c2
            where c2.patient_id = r.patient_id and c2.practitioner_id is null
         )
      returning id into new_id;
    end if;
    if new_id is null then
      insert into public.patients (doctor_id, practitioner_id, full_name, birth_date, email, phone, created_at, updated_at)
      select doctor_id, r.practitioner_id, full_name, birth_date, email, phone, created_at, updated_at
        from public.patients where id = r.patient_id
      on conflict do nothing
      returning id into new_id;
      if new_id is null then
        select p2.id into new_id
          from public.patients p1
          join public.patients p2
            on p2.doctor_id = p1.doctor_id
           and p2.practitioner_id is not distinct from r.practitioner_id
           and lower(p2.full_name) = lower(p1.full_name)
           and coalesce(p2.birth_date, date '1900-01-01') = coalesce(p1.birth_date, date '1900-01-01')
         where p1.id = r.patient_id;
      end if;
      update public.consents
         set patient_id = new_id
       where patient_id = r.patient_id
         and practitioner_id is not distinct from r.practitioner_id;
    end if;
  end loop;
end $$;

create index if not exists patients_practitioner_idx on public.patients (doctor_id, practitioner_id);
