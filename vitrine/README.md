# Woui — Site vitrine

Vitrine statique en français. Les pages sont générées dans `dist/` à partir de `src/pages.mjs`, sans dépendance npm. Les illustrations représentent des données fictives.

## Commandes

- `npm run build` génère les pages, les assets, le sitemap et robots.txt.
- `npm run dev` sert le dossier généré sur le port 4173 avec Node.js.
- `vercel deploy --prod` publie le projet lié sur Vercel. Le dossier de sortie et les URL sans extension sont configurés dans `vercel.json`.

## Paramètres

- `WOUI_SITE_URL` fixe l’origine canonique si un domaine personnalisé devient l’adresse publique. Sinon le domaine de production Vercel est utilisé.
- `WOUI_SIGNUP_URL` est l’URL publique de l’inscription praticien. Par défaut, l’inscription publique de l’application Woui est utilisée. Une chaîne vide bascule les demandes d’essai vers l’e-mail de l’équipe Woui.
- L’adresse de contact et le lien de connexion sont définis dans `src/pages.mjs`.

## Après intégration

- Rédiger et valider les CGU et la politique de confidentialité de l’application Woui. L’inscription renvoie actuellement vers `https://woui.fr/cgu` et `https://woui.fr/confidentialite`. Publier les textes définitifs et vérifier les deux liens dans le formulaire d’inscription.
- Intégrer les vidéos pédagogiques par acte dans l’espace patient. La vitrine présente cette partie du parcours comme étant en préparation.

## Déploiement

- Production : https://woui-vitrine.vercel.app
- Projet Vercel `woui-vitrine`, relié au dépôt GitHub `Dylan973/woui-app` avec `vitrine` comme dossier racine.
- Chaque envoi sur la branche `main` met le site en ligne automatiquement.
