# Woui — inventaire des écrans

Référence de travail pour le développement de l'app praticien et de l'espace patient.
Tenir ce fichier à jour à chaque ajout ou modification d'écran.

## Comment les écrans sont comptés

Un **écran** = une vue complète sur laquelle l'utilisateur arrive et qui exclut les autres :
une route, un onglet, une modale, ou un état mutuellement exclusif d'une page (chargement,
erreur, succès). Les messages en ligne (bandeau d'erreur de connexion, liste vide du tableau
de bord, message d'erreur de signature) ne comptent pas : ils s'affichent *dans* un écran existant.

Avec cette règle : **4 fichiers de pages**, **4 routes**, **16 écrans**.

## Routes

| Route | Accès | Fichier | Écrans |
| --- | --- | --- | --- |
| `/login` | public | `src/pages/LoginPage.tsx` | 1 |
| `/dashboard` | privé (praticien authentifié) | `src/pages/DashboardPage.tsx` | 4 |
| `/settings` | privé (praticien authentifié) | `src/pages/SettingsPage.tsx` | 5 |
| `/sign/:token` | public (aucune session Supabase) | `src/pages/SignaturePage.tsx` | 5 |

`/` et toute route inconnue redirigent vers `/dashboard` (si session) ou `/login` — voir `src/App.tsx`.
L'écran « Profil praticien introuvable » (n° 11) peut se substituer à n'importe quelle route privée.

Légende des statuts : ✅ complet · ⚠️ partiel · 🚧 placeholder « Bientôt »

---

## `/login`

### 1. Connexion praticien

- **Route** : `/login`
- **Fichier** : `src/pages/LoginPage.tsx`
- **Statut** : ✅ complet
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : `auth.signInWithPassword` (via `useAuth.signIn`) · `auth.resetPasswordForEmail`
  (lien de réinitialisation, `redirectTo` = `VITE_APP_URL/login`)

---

## `/dashboard`

Tous les écrans de cette route dépendent du chargement préalable de `useAuth`
(`auth.getSession`, `auth.onAuthStateChange`, `from('doctors').select().eq('user_id')`)
et de `useConsents` (`from('consents').select().eq('doctor_id')` + abonnement realtime
`postgres_changes` filtré sur `doctor_id`).

### 2. Tableau de bord — liste des consentements

- **Route** : `/dashboard`
- **Fichier** : `src/pages/DashboardPage.tsx`
- **Statut** : ⚠️ partiel — les boutons « Relancer » et « Relancer les N patients » affichent
  un toast « fonctionnalité à venir », aucune relance n'est réellement envoyée
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : lecture seule via le contexte du layout (aucun appel direct) ; les statuts
  se mettent à jour en direct via l'abonnement realtime de `useConsents`

### 3. Tutoriel de première visite

- **Route** : `/dashboard` (modale plein écran)
- **Fichier** : `src/pages/DashboardPage.tsx` (composant `TutorialModal`)
- **Statut** : ✅ complet
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : aucun — l'état « déjà vu » est stocké dans `localStorage('woui_tutorial_seen')`

### 4. Nouveau consentement

- **Route** : `/dashboard` (modale)
- **Fichier** : `src/components/dashboard/SendModal.tsx`
- **Statut** : ✅ complet
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : `from('consents').insert()` puis `functions.invoke('send-consent')`
  (Edge Function qui envoie l'email du lien de signature via Resend). Si l'email échoue,
  le consentement reste créé et l'erreur est remontée dans la modale.

### 5. Limite de plan atteinte

- **Route** : `/dashboard` (modale, état exclusif de l'écran 4)
- **Fichier** : `src/components/dashboard/SendModal.tsx`
- **Statut** : ⚠️ partiel — le bouton « Voir les plans » ferme la modale sans naviguer vers `/settings`
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : aucun — comparaison côté client entre `consents.length` et la limite du plan
  définie dans `src/lib/constants.ts`

---

## `/settings`

Mêmes dépendances de chargement que `/dashboard` (`useAuth` + `useConsents` via le layout).

### 6. Paramètres — Profil

- **Route** : `/settings` (onglet par défaut)
- **Fichier** : `src/pages/SettingsPage.tsx`
- **Statut** : ✅ complet
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : `from('doctors').update({ first_name, last_name, specialty, phone, updated_at })`
  filtré sur `id`. L'email n'est pas modifiable.

### 7. Paramètres — Abonnement

- **Route** : `/settings` (onglet)
- **Fichier** : `src/pages/SettingsPage.tsx`
- **Statut** : ✅ complet — le changement de plan est délégué au portail client SureCart
  (`SURECART_PORTAL_URL` dans `src/lib/constants.ts`)
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : aucun appel direct. Le plan affiché vient de `doctors.plan` chargé par `useAuth` ;
  il est mis à jour côté serveur par l'Edge Function `surecart-webhook`.

### 8. Paramètres — Documents PDF

- **Route** : `/settings` (onglet)
- **Fichier** : `src/pages/SettingsPage.tsx`
- **Statut** : 🚧 placeholder « Bientôt »
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : aucun

### 9. Paramètres — Notifications

- **Route** : `/settings` (onglet)
- **Fichier** : `src/pages/SettingsPage.tsx`
- **Statut** : 🚧 placeholder « Bientôt »
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : aucun

### 10. Paramètres — Sécurité

- **Route** : `/settings` (onglet)
- **Fichier** : `src/pages/SettingsPage.tsx`
- **Statut** : 🚧 placeholder « Bientôt »
- **Dernière modif** : 2026-09-03 (`776c2aa`)
- **Supabase** : aucun

---

## Écran transverse (routes privées)

### 11. Profil praticien introuvable

- **Route** : se substitue à `/dashboard` ou `/settings`
- **Fichier** : `src/components/layout/AppLayout.tsx`
- **Statut** : ✅ complet
- **Dernière modif** : 2026-09-02 (`b5f08bc`)
- **Supabase** : déclenché quand `from('doctors').select().eq('user_id')` ne renvoie aucune ligne
  alors que la session Auth est valide. Propose `auth.signOut()`.

---

## `/sign/:token` — espace patient

Route 100 % publique, aucune session Supabase. L'accès repose sur le `token` (UUID généré par
Postgres) et sur les policies RLS patient de `supabase/migrations/0002_patient_access_policies.sql`.
Thème clair/sombre propre à la page, stocké dans `localStorage('woui_patient_theme')`.

### 12. Chargement

- **Route** : `/sign/:token`
- **Fichier** : `src/pages/SignaturePage.tsx`
- **Statut** : ✅ complet (squelette animé)
- **Dernière modif** : 2026-09-22 (`9853cd5`)
- **Supabase** : `from('consents').select('*').eq('token').maybeSingle()` en cours

### 13. Lien invalide ou expiré

- **Route** : `/sign/:token`
- **Fichier** : `src/pages/SignaturePage.tsx`
- **Statut** : ✅ complet
- **Dernière modif** : 2026-09-22 (`9853cd5`)
- **Supabase** : affiché quand la requête ci-dessus renvoie une erreur ou aucune ligne

### 14. Consentement déjà signé

- **Route** : `/sign/:token`
- **Fichier** : `src/pages/SignaturePage.tsx`
- **Statut** : ✅ complet
- **Dernière modif** : 2026-09-22 (`9853cd5`)
- **Supabase** : affiché quand `consents.status = 'signed'` au chargement (date issue de `signed_at`)

### 15. Parcours de signature

- **Route** : `/sign/:token`
- **Fichier** : `src/pages/SignaturePage.tsx` + `src/components/signature/VideoPlayer.tsx`
  + `src/components/signature/SignatureCanvas.tsx`
- **Statut** : ⚠️ partiel — la vidéo est encore un placeholder (`PLACEHOLDER_SRC` dans `VideoPlayer.tsx`),
  et les champs « Praticien » / adresse du cabinet du design ne sont pas affichés faute d'être
  présents dans la table `consents`
- **Dernière modif** : 2026-09-22 (`9853cd5`)
- **Supabase** :
  - `update({ status: 'opened', opened_at })` à la première ouverture du lien
  - `update({ video_progress })` pendant la lecture (throttlé à 5 s)
  - `update({ status: 'viewed', viewed_at })` au seuil de 90 % (déclenché par `VideoPlayer`)
  - La signature ne se déverrouille qu'à **97 %** de progression, côté page

### 16. Confirmation de signature

- **Route** : `/sign/:token`
- **Fichier** : `src/pages/SignaturePage.tsx`
- **Statut** : ✅ complet
- **Dernière modif** : 2026-09-22 (`9853cd5`)
- **Supabase** : `update({ status: 'signed', signed_at, signature_data })` — `signature_data`
  est la signature tracée, encodée en PNG base64

---

## Écrans prévus mais non développés

| Écran | Point d'entrée existant | Blocage |
| --- | --- | --- |
| Statistiques | bouton désactivé dans `src/components/layout/Header.tsx` | aucune route, aucune vue |
| Recherche patient | champ décoratif (`⌘K`) dans le header | non branché |
| Relance de consentement | boutons du tableau de bord | affichent un toast « à venir » |
