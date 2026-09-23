# Woui — App praticien

SaaS B2B pour chirurgiens-dentistes : envoi de consentements éclairés numériques
(vidéo + signature électronique) aux patients. React 18 + Vite + TypeScript + Tailwind + Supabase.

## Stack

- **Frontend** : React 18, Vite, TypeScript strict, Tailwind CSS v3
- **Auth + BDD** : Supabase (Auth + PostgreSQL + Realtime + Edge Functions)
- **Routing** : React Router v6
- **Hébergement** : Vercel

## Architecture

Quatre routes, quatre fichiers de pages, **16 écrans** (un écran = une vue complète et exclusive :
route, onglet, modale ou état de page). Détail complet — dépendances Supabase comprises — dans
[`SCREENS.md`](SCREENS.md).

| Route | Accès | Fichier |
| --- | --- | --- |
| `/login` | public | `src/pages/LoginPage.tsx` |
| `/dashboard` | privé | `src/pages/DashboardPage.tsx` |
| `/settings` | privé | `src/pages/SettingsPage.tsx` |
| `/sign/:token` | public, sans session | `src/pages/SignaturePage.tsx` |

Statuts : ✅ complet · ⚠️ partiel · 🚧 placeholder « Bientôt »

| # | Écran | Route | Fichier | Statut |
| --- | --- | --- | --- | --- |
| 1 | Connexion praticien | `/login` | `src/pages/LoginPage.tsx` | ✅ |
| 2 | Tableau de bord — liste | `/dashboard` | `src/pages/DashboardPage.tsx` | ⚠️ relances non branchées |
| 3 | Tutoriel 1re visite | `/dashboard` (modale) | `src/pages/DashboardPage.tsx` | ✅ |
| 4 | Nouveau consentement | `/dashboard` (modale) | `src/components/dashboard/SendModal.tsx` | ✅ |
| 5 | Limite de plan atteinte | `/dashboard` (modale) | `src/components/dashboard/SendModal.tsx` | ⚠️ |
| 6 | Paramètres — Profil | `/settings` | `src/pages/SettingsPage.tsx` | ✅ |
| 7 | Paramètres — Abonnement | `/settings` | `src/pages/SettingsPage.tsx` | ✅ |
| 8 | Paramètres — Documents PDF | `/settings` | `src/pages/SettingsPage.tsx` | 🚧 |
| 9 | Paramètres — Notifications | `/settings` | `src/pages/SettingsPage.tsx` | 🚧 |
| 10 | Paramètres — Sécurité | `/settings` | `src/pages/SettingsPage.tsx` | 🚧 |
| 11 | Profil praticien introuvable | routes privées | `src/components/layout/AppLayout.tsx` | ✅ |
| 12 | Signature — chargement | `/sign/:token` | `src/pages/SignaturePage.tsx` | ✅ |
| 13 | Signature — lien invalide | `/sign/:token` | `src/pages/SignaturePage.tsx` | ✅ |
| 14 | Signature — déjà signé | `/sign/:token` | `src/pages/SignaturePage.tsx` | ✅ |
| 15 | Signature — parcours | `/sign/:token` | `src/pages/SignaturePage.tsx` | ⚠️ vidéo placeholder |
| 16 | Signature — confirmation | `/sign/:token` | `src/pages/SignaturePage.tsx` | ✅ |

Écrans prévus mais non développés : Statistiques, Recherche patient, Relance de consentement.

### Branches

- `main` — branche de production, c'est elle qui est déployée sur Vercel.
- `dev` — branche d'intégration : le travail en cours part de `dev` et remonte vers `main` par merge.

## Démarrage local

```bash
npm install
cp .env.example .env   # puis renseigner VITE_SUPABASE_ANON_KEY
npm run dev
```

> Un `.env` avec la clé publique du projet Supabase existant (`kflyeygbwirqhbsirncg`) est déjà
> fourni pour le dev local — il n'est jamais commité (voir `.gitignore`).

## Connecter Supabase (à faire une seule fois)

1. **Tables** : dans le Dashboard Supabase → SQL Editor, exécuter le contenu de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Il crée `doctors` et `consents`, active la RLS, les policies, les index, et ajoute
   `consents` à la publication realtime.
2. **Auth** : créer les comptes praticiens dans Dashboard → Authentication → Users
   (ou via le flux SureCart, à automatiser plus tard — cf. webhook ci-dessous),
   puis insérer la ligne `doctors` correspondante avec le même `user_id`.
3. **Edge Functions** (nécessite le [Supabase CLI](https://supabase.com/docs/guides/cli)) — déjà déployées sur
   `kflyeygbwirqhbsirncg`, pour référence future :
   ```bash
   supabase login --token <votre access token, https://supabase.com/dashboard/account/tokens>
   supabase link --project-ref kflyeygbwirqhbsirncg
   supabase functions deploy send-consent
   supabase functions deploy surecart-webhook --no-verify-jwt
   ```
   `send-consent` envoie l'email via **Resend** (secret `RESEND_API_KEY`, déjà configuré sur ce projet
   depuis une itération précédente — on le réutilise plutôt que d'ajouter un second système d'envoi).
   Le secret `APP_URL` existait aussi déjà (pointant vers l'app en prod) et sert à construire le lien
   `/sign/:token` dans l'email.

   ⚠️ `surecart-webhook/index.ts` est une implémentation de référence — son code source
   original n'était pas présent dans les fichiers fournis. Avant la prod, vérifiez dans
   SureCart → Developers → Webhooks le nom exact de l'en-tête de signature, ajoutez le secret
   `SURECART_WEBHOOK_SECRET`, et complétez `PRICE_TO_PLAN` avec vos vrais IDs de prix.
4. Configurer l'URL du webhook dans SureCart : `https://kflyeygbwirqhbsirncg.supabase.co/functions/v1/surecart-webhook`.

## Déployer sur Vercel

1. Pousser le repo sur GitHub, puis importer le projet dans Vercel.
2. Vercel détecte Vite automatiquement (`vite build`, dossier `dist`). `vercel.json` gère déjà
   la réécriture SPA pour React Router.
3. Ajouter les variables d'environnement dans **Vercel → Settings → Environment Variables** :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL` (l'URL Vercel générée, ou `https://app.woui.fr` en prod)
4. Déployer. Vérifier que `/dashboard`, `/settings`, `/login` et `/sign/:token` répondent bien
   (pas de 404 SPA) et que `APP_URL` de l'Edge Function `send-consent` pointe vers la même URL.

## Structure

Voir l'arborescence dans `src/` — `pages/` (routes), `components/` (layout, dashboard, signature, ui),
`hooks/` (`useAuth`, `useConsents`), `lib/` (client Supabase, constantes), `types/`.

## Contraintes respectées

- Jamais de `service_role` key côté client — uniquement `VITE_SUPABASE_ANON_KEY`.
- RLS activée sur `doctors` et `consents`.
- Token de signature = UUID généré par Postgres, jamais deviné.
- `/sign/:token` est 100% public, aucune session Supabase requise.
- Espace praticien : thème suivant la préférence système au premier chargement, choix manuel
  stocké dans `localStorage('woui-theme')` et posé sur `<html>` avant le premier paint (`index.html`).
- Espace patient : thème propre, clair par défaut, stocké dans `localStorage('woui_patient_theme')` —
  il n'hérite pas du thème praticien.
- Navigation praticien : header collant en haut de page (`src/components/layout/Header.tsx`),
  qui se replie sur mobile. Pas de sidebar ni de bottom nav.
