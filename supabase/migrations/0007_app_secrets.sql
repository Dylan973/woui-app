-- Réglages serveur (ex. secret du webhook Stripe créé automatiquement par stripe-setup).
-- Lisibles uniquement par les fonctions serveur (service_role), jamais par l'app.
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
