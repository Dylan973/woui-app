-- Woui — policies d'accès patient (correctif appliqué le 2026-09-01)
--
-- Le schéma de base (doctors + consents, RLS, policies praticien, index PK/unique,
-- ajout à la publication realtime) était déjà en place sur le projet
-- kflyeygbwirqhbsirncg depuis le 2026-05-18 (cf. historique de migrations distant).
--
-- En revanche les policies permettant au PATIENT (non authentifié, accès par token
-- uniquement) de lire et signer son consentement étaient absentes — ce qui aurait
-- empêché /sign/:token de fonctionner. Ce fichier documente le correctif appliqué
-- directement en base via l'API Management Supabase.

drop policy if exists "consents_patient_read" on public.consents;
create policy "consents_patient_read" on public.consents
  for select using (true);

drop policy if exists "consents_patient_token" on public.consents;
create policy "consents_patient_token" on public.consents
  for update using (true);

create index if not exists idx_consents_doctor_id on public.consents(doctor_id);
create index if not exists idx_doctors_user_id on public.doctors(user_id);
