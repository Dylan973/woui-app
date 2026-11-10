-- Essai de 7 jours à la création d'une nouvelle fiche praticien.
-- Les dates d'expiration déjà enregistrées sont conservées.

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
    now() + interval '7 days'
  )
  on conflict (email) do update
    set user_id = excluded.user_id
    where public.doctors.user_id is null;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
