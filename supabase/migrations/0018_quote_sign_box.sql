-- Devis : emplacement des cadres de signature repérés dans le PDF au dépôt
-- ({ page, patient: {x,y,w,h}, practitioner: {x,y,w,h} }, coordonnées PDF).
alter table public.consents add column if not exists quote_sign_box jsonb;
alter table public.consents drop constraint if exists consents_quote_sign_box_check;
alter table public.consents add constraint consents_quote_sign_box_check check (quote_sign_box is null or (jsonb_typeof(quote_sign_box) = 'object' and length(quote_sign_box::text) < 2000));
grant insert (quote_sign_box) on public.consents to authenticated;
