-- Essai gratuit de 7 jours AVEC carte bancaire.
-- Un nouveau compte démarre en « incomplete » : aucun envoi possible tant que la carte
-- n'a pas été enregistrée via Stripe Checkout. Le webhook Stripe passe ensuite le
-- compte en « trialing » (fin d'essai = trial_end), puis « active » au premier paiement.

alter table public.doctors drop constraint if exists doctors_plan_status_check;
alter table public.doctors
  add constraint doctors_plan_status_check
  check (plan_status in ('incomplete', 'trialing', 'active', 'past_due', 'cancelled'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  chosen text := coalesce(new.raw_user_meta_data->>'plan', 'pro');
  chosen_interval text := coalesce(new.raw_user_meta_data->>'interval', 'monthly');
begin
  if chosen not in ('starter', 'pro', 'clinic') then
    chosen := 'pro';
  end if;
  if chosen_interval not in ('monthly', 'yearly') then
    chosen_interval := 'monthly';
  end if;

  insert into public.doctors (user_id, email, first_name, last_name, plan, billing_interval, plan_status, plan_expires_at)
  values (
    new.id,
    lower(new.email),
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    chosen,
    chosen_interval,
    'incomplete',
    null
  )
  on conflict (email) do update
    set user_id = excluded.user_id
    where public.doctors.user_id is null;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Comptes d'essai créés sans carte (tests) : ils passent par le nouveau parcours.
update public.doctors
   set plan_status = 'incomplete', plan_expires_at = null, updated_at = now()
 where plan_status = 'trialing'
   and stripe_subscription_id is null;
