# WOUI — Brief refonte design pour Claude Code
# Intégration du nouveau design Claude Design dans le projet React/Vite existant

---

## CONTEXTE

Le projet React/Vite Woui est déjà construit (voir CLAUDE_CODE_BRIEF.md).
Claude Design a produit une refonte visuelle complète du dashboard.
Ce brief décrit UNIQUEMENT les changements de design à appliquer.
La logique métier, le routing, l'auth Supabase — ne pas y toucher.

---

## CE QUI CHANGE vs L'ANCIEN DESIGN

| Élément         | Avant (dark)              | Après (nouveau)                    |
|-----------------|---------------------------|------------------------------------|
| Mode            | Dark mode par défaut      | Light mode par défaut              |
| Layout          | Sidebar 230px à gauche    | Header horizontal fixe en haut     |
| Police display  | Montserrat                | Newsreader (serif) + Manrope       |
| Police mono     | —                         | IBM Plex Mono                      |
| Couleur accent  | #0ea5e9 (bleu)            | #9c1a20 (garnet rouge bordeaux)    |
| Border-radius   | 16px (très arrondi)       | 4px (presque carré, editorial)     |
| Fond            | #050a14 (noir bleu)       | #faf8f5 (stone beige chaud)        |

---

## FICHIERS À MODIFIER

### 1. src/index.css — Remplacer TOUTES les variables CSS

```css
/* Google Fonts à importer */
@import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@300;400;500&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  /* Neutrals — stone beige chaud */
  --stone-0: #ffffff;
  --stone-50: #faf8f5;
  --stone-100: #f2efe9;
  --stone-200: #e6e1d8;
  --stone-300: #d2ccc0;
  --stone-400: #a9a196;
  --stone-500: #7e7669;
  --stone-600: #5c554b;
  --stone-700: #3f3a33;
  --stone-800: #2a2621;

  /* Navy — bleu nuit profond */
  --navy-900: #10151d;
  --navy-800: #161d28;
  --navy-700: #1e2735;
  --navy-600: #2b3648;
  --navy-500: #445267;

  /* Garnet — rouge bordeaux médical */
  --garnet-700: #7c1319;
  --garnet-600: #9c1a20;
  --garnet-500: #b8232a;
  --garnet-400: #cf3a3f;
  --garnet-100: #f6e3e3;

  /* Surfaces */
  --surface-page: var(--stone-50);
  --surface-card: var(--stone-0);
  --surface-card-alt: var(--stone-100);
  --surface-inverse: var(--navy-900);
  --surface-inverse-alt: var(--navy-800);
  --surface-overlay: rgba(16, 21, 29, 0.62);

  /* Text */
  --text-primary: var(--navy-900);
  --text-secondary: var(--stone-600);
  --text-muted: var(--stone-500);
  --text-inverse: var(--stone-50);
  --text-inverse-muted: rgba(250, 248, 245, 0.64);
  --text-accent: var(--garnet-600);

  /* Borders */
  --border-subtle: var(--stone-200);
  --border-default: var(--stone-300);
  --border-inverse: rgba(250, 248, 245, 0.16);
  --border-accent: var(--garnet-500);

  /* Actions */
  --action-primary: var(--navy-900);
  --action-primary-hover: var(--navy-700);
  --action-primary-text: var(--stone-50);
  --action-accent: var(--garnet-600);
  --action-accent-hover: var(--garnet-700);
  --action-accent-text: var(--stone-50);

  /* Focus */
  --focus-ring: var(--garnet-500);

  /* Typography */
  --font-display: 'Newsreader', 'Georgia', serif;
  --font-body: 'Manrope', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;

  /* Type scale */
  --text-display-2: 400 clamp(2.25rem, 1.8rem + 2vw, 3.5rem)/1.08 var(--font-display);
  --text-display-3: 400 clamp(1.75rem, 1.5rem + 1vw, 2.5rem)/1.15 var(--font-display);
  --text-stat: 400 clamp(2.5rem, 2rem + 2vw, 4rem)/1 var(--font-display);
  --text-eyebrow: 600 0.8125rem/1.2 var(--font-body);
  --text-body: 400 1.0625rem/1.6 var(--font-body);
  --text-sm: 400 0.9375rem/1.5 var(--font-body);
  --text-xs: 500 0.8125rem/1.4 var(--font-body);
  --tracking-eyebrow: 0.14em;

  /* Spacing */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px;

  /* Shape */
  --radius-sm: 2px;
  --radius-md: 4px;   /* ← cartes, boutons, inputs */
  --radius-lg: 6px;
  --radius-pill: 999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(16, 21, 29, 0.06);
  --shadow-md: 0 8px 24px rgba(16, 21, 29, 0.08);
  --shadow-lg: 0 24px 48px rgba(16, 21, 29, 0.14);

  /* Easing */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-base: 260ms;
}

/* Animations */
@keyframes nb-rise {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes nb-grow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

body {
  font-family: var(--font-body);
  background: var(--surface-page);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}
```

---

### 2. src/components/layout/AppLayout.tsx — Nouveau layout

**Remplacer la sidebar par un header horizontal.**

```tsx
// Structure HTML cible :
// <div style={{ minHeight: '100vh', background: 'var(--surface-page)' }}>
//   <Header />                    ← fixe en haut, z-index 40
//   <main style={{ padding: '40px 34px 90px', maxWidth: 1520, margin: '0 auto' }}>
//     <Outlet />
//   </main>
// </div>

// SUPPRIMER : la sidebar latérale et le bottom nav mobile
// AJOUTER : Header horizontal

// Le dark mode toggle reste fonctionnel
// Sur mobile (<768px) : header simplifié avec menu hamburger
```

---

### 3. src/components/layout/Header.tsx — NOUVEAU fichier à créer

```tsx
// Structure du header :
// height: 68px
// position: sticky; top: 0; z-index: 40
// background: var(--surface-page)
// border-bottom: 1px solid var(--border-subtle)
// padding: 0 34px
// display: flex; align-items: center; gap: 28px

// Contenu de gauche à droite :
// 1. Logo : carré 32px background garnet #9c1a20, border-radius 3px, + img Woui
//    suivi du texte "Woui" en font-display 19px
//
// 2. Nav pills (margin-left 18px) :
//    - "Tableau de bord" → /dashboard
//    - "Statistiques" → /stats (disabled, bientôt)
//    - "Paramètres" → /settings
//    Style actif : background stone-100, color navy-900
//    Style inactif : background transparent, color stone-500
//    Padding: 8px 16px, border-radius: 3px, font-size: 0.8125rem, font-family: body
//
// 3. Côté droit (margin-left: auto) :
//    - Barre de recherche factice :
//      border: 1px solid var(--border-subtle), border-radius: 3px
//      padding: 8px 14px, min-width: 220px, color: text-muted, font-size: 13px
//      Icône loupe + texte "Rechercher un patient" + kbd "⌘K" (font-mono, opacity .7)
//    - Bouton thème : 36×36px, border border-subtle, border-radius 3px
//    - Bouton "+ Nouveau consentement" (uniquement sur /dashboard) :
//      background: var(--action-accent), color: stone-50
//      padding: 10px 20px, border-radius: 3px, font-weight: 600
//    - Avatar praticien : cercle 36px, background navy-900, initiales en stone-50
//      avec dropdown : Paramètres + Déconnexion
```

---

### 4. src/pages/DashboardPage.tsx — Nouveau layout des sections

#### Section hero (nouvelle — remplace les 4 cards stats identiques)

```tsx
// Grille 1.35fr 1fr, gap 26px

// Card gauche (hero) :
// background: var(--surface-card)
// border: 1px solid var(--border-subtle)
// border-radius: 4px
// padding: 34px 36px
// position: relative; overflow: hidden
//
// Déco : div absolu top:-80px right:-60px, 260px cercle,
//        radial-gradient garnet rgba(184,35,42,0.22)
//
// Contenu :
// - Eyebrow : flex + trait 18px + texte "À traiter maintenant"
//   font: var(--text-eyebrow), letter-spacing: var(--tracking-eyebrow)
//   text-transform: uppercase; color: var(--text-accent)
// - H1 : "X patients attendent votre relance"
//   font: var(--text-display-2), font-size: 40px, margin-top: 18px
//   letter-spacing: -0.01em; max-width: 18ch
// - P : sous-texte descriptif, color: text-secondary, max-width: 46ch
// - Boutons : "Relancer les X patients" (accent) + "Voir le détail" (ghost)

// Card droite = grille 2×2 (4 stats) :
// background: border-subtle (fond de grille avec gap: 1px)
// border: 1px solid var(--border-subtle); border-radius: 4px; overflow: hidden
// Chaque cellule stat :
//   background: var(--surface-card); padding: 24px 28px
//   Label : font-mono, 11px, uppercase, letter-spacing 0.1em, color: text-muted
//   Valeur : font: var(--text-stat), font-size: 38px, margin-top: 8px
//   Variation : +X ce mois, font-size: 12px, color: text-muted, margin-top: 4px
//
// 4 stats : Envoyés / En attente / Visionnés / Signés
```

#### Tableau des consentements (remplacer l'existant)

```tsx
// Conteneur :
// background: var(--surface-card)
// border: 1px solid var(--border-subtle)
// border-radius: 4px
// margin-top: 26px
// overflow: hidden

// Toolbar au-dessus du tableau :
// padding: 20px 28px; border-bottom: 1px solid var(--border-subtle)
// display: flex; align-items: center; justify-content: space-between
//
// Gauche : titre "Consentements" (font-display-3, font-size: 22px)
//          + badge count (fond stone-100, border-radius: 2px, font-mono, 12px)
//
// Droite : filtres pills :
//   "Tous" | "Envoyés" | "Visionnés" | "Signés"
//   Style actif : background navy-900, color stone-50
//   Style inactif : background transparent, border border-subtle, color text-muted
//   padding: 6px 14px; border-radius: 3px; font-size: 12px; font-mono

// En-tête colonnes :
// background: var(--surface-card-alt)
// padding: 12px 28px; border-bottom: 1px solid var(--border-subtle)
// font-mono, 10px, uppercase, letter-spacing 0.12em, color: text-muted
// Colonnes : Patient | Acte | Envoyé le | Progression | Statut | Signé le | (actions)

// Lignes :
// padding: 16px 28px; border-bottom: 1px solid var(--border-subtle)
// hover: background stone-50
// Nom patient : font-weight 500, navy-900
// Email : font-size 12px, text-muted, font-mono
// Acte : text-secondary, font-size 14px
// Date : font-mono, 13px, text-muted
// Barre progression : height 3px, background border-subtle, fill garnet
// Statut : badge avec dot (voir badges ci-dessous)

// BADGES STATUT (nouveau style) :
// sent:   fond stone-100, texte stone-600, dot stone-400
// opened: fond amber-50 (#fffbeb), texte amber-700 (#92400e), dot amber-500
// viewed: fond blue-50  (#eff6ff), texte blue-700  (#1d4ed8), dot blue-500
// signed: fond green-50 (#f0fdf4), texte green-700 (#15803d), dot green-500
// Style commun : padding 4px 10px; border-radius: var(--radius-pill)
//   font-family: font-mono; font-size: 11px; letter-spacing: 0.08em
//   display: inline-flex; align-items: center; gap: 6px
//   dot : width 5px; height 5px; border-radius: 50%
```

---

### 5. src/components/dashboard/SendModal.tsx — Nouveau style

```tsx
// Overlay : background var(--surface-overlay), backdrop-filter blur(8px)
// Modal : background surface-card, border-radius 4px, padding 36px
//   max-width: 460px, border: 1px solid border-default
//   box-shadow: var(--shadow-lg)
//
// Header : titre font-display-3 + bouton × (stone-400, hover navy-900)
//
// Inputs :
//   Label : font-mono, 10px, uppercase, letter-spacing 0.12em, color text-muted
//   Input : background stone-100, border 1px border-subtle, border-radius: 3px
//           padding: 12px 14px; font: text-body; font-family: body
//           focus → border-color: garnet-500
//
// Select acte médical : même style que les inputs
//
// Boutons :
//   Annuler : border border-default, background transparent, color text-muted
//             border-radius 3px; padding 12px
//   Envoyer : background action-accent (#9c1a20), color stone-50
//             border-radius 3px; padding 12px; font-weight 600
//             disabled → background stone-200; cursor not-allowed
```

---

### 6. src/pages/SettingsPage.tsx — Nouveau style

```tsx
// Tabs verticaux à gauche (220px) — même structure qu'avant
// mais avec le nouveau design system :
// Tab actif : background stone-100, border-left 2px garnet, color navy-900
// Tab inactif : transparent, color text-muted
// Tab "bientôt" : opacity 0.5, cursor not-allowed
//
// Badge "bientôt" :
//   background: stone-100; color: text-muted
//   font-family: font-mono; font-size: 10px; letter-spacing: 0.1em
//   text-transform: uppercase; padding: 2px 6px; border-radius: 2px
//
// Card profil :
//   background: surface-card; border: 1px solid border-subtle
//   border-radius: 4px; padding: 32px
//
// Section abonnement — usage bar :
//   height: 3px, background border-subtle
//   fill : animation nb-grow + color action-accent
//
// Plans cards :
//   border-radius: 4px; padding: 28px
//   Plan actuel : border-color action-accent, badge "Actuel" top-right garnet
//   Autres : border border-subtle

// Bouton Sauvegarder :
//   variant primary (navy-900) ou accent (garnet) selon contexte
```

---

### 7. src/pages/LoginPage.tsx — Nouveau style

```tsx
// Layout : centré, fond stone-50
// Card : fond surface-card, border border-subtle, border-radius 4px
//        padding: 48px; max-width: 420px; box-shadow: shadow-md
//
// Logo : même que header (carré garnet + texte Newsreader)
// Titre : font-display-3, "Espace praticien"
// Sous-titre : text-secondary, font-size 15px
//
// Inputs : style identique à SendModal
//
// Bouton connexion : full-width, action-accent (garnet), border-radius 3px
//                   font-weight 600; padding: 14px
//
// Lien "Mot de passe oublié" : color text-accent, font-size 13px
//
// Message d'erreur : fond garnet-100, border garnet-200, color garnet-700
//                    border-radius 3px, padding 12px, font-size 14px
```

---

### 8. src/pages/SignaturePage.tsx — Nouveau style patient

```tsx
// Fond : surface-page (stone-50) — page claire, rassurante
// Header minimaliste : logo + "Espace Patient Sécurisé" (pas de nav)
//
// Conteneur : max-width 680px, centré, padding: 48px 24px
//
// Étapes numérotées (1, 2, 3) :
//   Cercle numéro : 28px, background navy-900, color stone-50
//   font-mono, font-size 13px
//
// Section vidéo :
//   Conteneur : background navy-900, border-radius 4px, aspect-ratio 16/9
//   Barre progression : 3px, fond navy-700, fill garnet
//   Texte "X% visionné" : font-mono, 12px, text-inverse-muted
//
// Section signature :
//   Canvas : background stone-0, border: 1px dashed border-default
//             border-radius: 4px (quand inactif : opacity 0.5)
//   Bouton Effacer : ghost, border-radius 3px, font-size 13px
//
// Checkbox confirmation :
//   accent-color: var(--garnet-500)
//   label : font-sm, text-secondary
//
// Bouton Signer :
//   full-width, action-accent (garnet), border-radius 3px
//   padding: 16px; font-weight: 600; font-size: 16px
//   disabled → stone-200, cursor not-allowed
//
// Page confirmation :
//   Icône ✓ : cercle 72px, background stone-100, color garnet
//   Titre : font-display-3, "Consentement enregistré"
//   Sous-texte : text-secondary
```

---

## RÉSUMÉ DES CHANGEMENTS FICHIERS

```
MODIFIER :
├── src/index.css                          ← tout remplacer (tokens + fonts)
├── src/components/layout/AppLayout.tsx   ← sidebar → header horizontal
├── src/components/layout/Sidebar.tsx     ← supprimer ou vider (remplacé par Header)
├── src/pages/DashboardPage.tsx           ← nouveau layout hero + tableau
├── src/pages/SettingsPage.tsx            ← nouveau style
├── src/pages/LoginPage.tsx               ← nouveau style light
├── src/pages/SignaturePage.tsx           ← nouveau style
├── src/components/dashboard/SendModal.tsx ← nouveau style
└── src/components/ui/Badge.tsx           ← nouveaux badges statuts

CRÉER :
└── src/components/layout/Header.tsx      ← nouveau composant header

NE PAS TOUCHER :
├── src/hooks/useAuth.ts                  ← logique auth intacte
├── src/hooks/useConsents.ts              ← logique données intacte
├── src/lib/supabase.ts                   ← connexion intacte
├── src/lib/constants.ts                  ← constantes intactes
├── src/types/index.ts                    ← types intacts
├── src/App.tsx                           ← routing intact
└── supabase/functions/                   ← edge functions intactes
```

---

## INSTRUCTION POUR CLAUDE CODE

```
Applique la refonte design décrite dans ce fichier au projet Woui existant.
Commence par src/index.css (variables + fonts), puis Header.tsx (nouveau),
puis AppLayout.tsx (supprimer sidebar, ajouter Header), puis les pages
dans cet ordre : Dashboard, Login, Settings, Signature, SendModal, Badge.

Ne touche pas aux hooks, types, lib, App.tsx ni aux Edge Functions.
Après chaque fichier modifié, vérifie qu'il n'y a pas d'erreur TypeScript.
Lance npm run dev à la fin et confirme que tout compile.
```
