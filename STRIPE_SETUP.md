# Mise en route Stripe — Woui

SureCart est retiré. Abonnements, essai gratuit et facturation passent par Stripe.

## Comment ça marche

1. Le dentiste crée son compte sur `/signup` (ou `/signup?plan=pro` depuis la vitrine) :
   **14 jours d'essai, sans carte**. Sa fiche `doctors` est créée automatiquement
   (`plan_status = trialing`).
2. Dans **Paramètres → Abonnement**, il choisit un plan (mensuel ou annuel −20 %) :
   fonction `stripe-checkout` → page de paiement Stripe. Les jours d'essai restants
   sont conservés (premier prélèvement à la fin de l'essai).
3. Stripe prévient la fonction `stripe-webhook`, qui met à jour `plan`, `plan_status`,
   `plan_expires_at` dans `doctors`.
4. Factures, carte, changement de plan et résiliation : portail client Stripe
   (fonction `stripe-portal`).
5. La base refuse tout envoi si l'essai est terminé, l'abonnement inactif ou le quota
   mensuel atteint.

## À faire une fois (mode TEST d'abord)

```bash
cd woui-app

# 1. Produits, prix, portail client et webhook dans Stripe (clé secrète TEST)
STRIPE_SECRET_KEY=sk_test_xxx node scripts/stripe-setup.mjs
#    → affiche STRIPE_WEBHOOK_SECRET=whsec_xxx

# 2. Secrets côté Supabase
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx STRIPE_WEBHOOK_SECRET=whsec_xxx \
  APP_URL=https://woui-app.vercel.app --project-ref kflyeygbwirqhbsirncg

# 3. Déployer les fonctions
supabase functions deploy stripe-checkout stripe-portal --project-ref kflyeygbwirqhbsirncg
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref kflyeygbwirqhbsirncg
```

Test : créer un compte sur `/signup`, choisir un plan, payer avec la carte
`4242 4242 4242 4242` (date future, CVC quelconque), puis vérifier que le plan
apparaît « Actuel » dans Paramètres → Abonnement.

Passage en production : relancer l'étape 1 avec `sk_live_...`, puis l'étape 2 avec
la clé live et le nouveau `whsec_...`.

## Supabase Auth (tableau de bord)

- Authentication → URL Configuration : Site URL = `https://woui-app.vercel.app`,
  Redirect URLs : `https://woui-app.vercel.app/**`
- Authentication → Providers → Email : activer « Leaked password protection »
- Authentication → Emails : personnaliser les emails de confirmation et de
  réinitialisation en français (expéditeur via Resend SMTP recommandé).

## Liens depuis la vitrine

- Essai gratuit : `https://woui-app.vercel.app/signup?plan=starter|pro|clinic`
- Se connecter : `https://woui-app.vercel.app/login`
