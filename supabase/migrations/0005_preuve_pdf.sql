-- Woui — preuve de signature et PDF archivé (2026-11-10)
--
-- La signature passe désormais par la fonction serveur `sign-consent`, qui :
--   - horodate côté serveur, relève l'adresse IP et l'appareil du patient ;
--   - génère le PDF signé, calcule son empreinte SHA-256 et l'archive dans le
--     stockage privé `consents` (dossier = id du praticien).
-- Le patient ne peut plus appeler `sign_consent` directement.

alter table public.consents add column if not exists signed_ip text;
alter table public.consents add column if not exists signed_user_agent text;
alter table public.consents add column if not exists document_hash text;

revoke execute on function public.sign_consent(text, text) from public, anon, authenticated;

-- Stockage privé des PDF (5 Mo max, PDF uniquement).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consents', 'consents', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- Le praticien ne lit que les PDF de son propre dossier. Aucune écriture côté client.
drop policy if exists "consents_pdf_lecture_praticien" on storage.objects;
create policy "consents_pdf_lecture_praticien" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'consents'
    and (storage.foldername(name))[1] in (
      select id::text from public.doctors where user_id = auth.uid()
    )
  );
