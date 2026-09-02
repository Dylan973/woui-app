# WOUI — Spec design finale (palette officielle)
# UNE SEULE SOURCE DE VÉRITÉ — à appliquer intégralement

---

## RÈGLE ABSOLUE

Ignorer tout brief précédent (garnet, Newsreader, Manrope, stone beige).
Cette spec remplace tout. Une seule palette, une seule typo.

---

## 1. TYPOGRAPHIE — Poppins uniquement

Une seule famille pour TOUT : display, corps, labels, chiffres, boutons.

```html
<!-- index.html — dans <head>, AVANT le CSS -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap">
```

```js
// tailwind.config.js
theme: {
  extend: {
    fontFamily: {
      sans: ['Poppins', 'Helvetica Neue', 'Arial', 'sans-serif'],
    }
  }
}
```

Règles d'usage :
- Titres de page, gros chiffres stats → Poppins 600
- Titres de carte, en-têtes tableau, boutons → Poppins 500
- Corps de texte, cellules → Poppins 400
- Labels secondaires, légendes → Poppins 400, couleur --text-muted
- Chiffres stats : font-variant-numeric: tabular-nums
- Sur body : -webkit-font-smoothing: antialiased

---

## 2. COULEURS — Variables CSS complètes

```css
/* src/index.css — REMPLACER TOUT le contenu par ceci */

@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

/* ── Script init thème (copier aussi dans index.html) ── */

:root, [data-theme="light"] {
  /* Surfaces */
  --surface-page:     #f4f5fa;
  --surface-card:     #ffffff;
  --surface-card-alt: #eeeff9;

  /* Texte */
  --text-primary:   #171734;
  --text-secondary: rgba(23, 23, 52, 0.62);
  --text-muted:     rgba(23, 23, 52, 0.42);
  --text-accent:    #6c5ce7;

  /* Accent indigo */
  --accent:       #6c5ce7;
  --accent-hover: #5a49d6;
  --accent-soft:  #8b7cf8;

  /* Mint — succès/progression uniquement */
  --mint:         #3fc79a;
  --mint-soft:    rgba(63, 199, 154, 0.15);

  /* Borders */
  --border-subtle:  rgba(23, 23, 52, 0.08);
  --border-default: rgba(23, 23, 52, 0.16);

  /* Actions */
  --action-primary:       #6c5ce7;
  --action-primary-text:  #ffffff;
  --action-primary-hover: #5a49d6;
  --action-accent:        #6c5ce7;
  --action-accent-text:   #ffffff;

  /* Statuts consentements */
  --status-sent-bg:    rgba(23, 23, 52, 0.06);
  --status-sent-text:  rgba(23, 23, 52, 0.55);
  --status-sent-dot:   rgba(23, 23, 52, 0.35);

  --status-opened-bg:   rgba(245, 158, 11, 0.10);
  --status-opened-text: #92400e;
  --status-opened-dot:  #f59e0b;

  --status-viewed-bg:   rgba(59, 130, 246, 0.10);
  --status-viewed-text: #1d4ed8;
  --status-viewed-dot:  #3b82f6;

  --status-signed-bg:   rgba(63, 199, 154, 0.12);
  --status-signed-text: #065f46;
  --status-signed-dot:  #3fc79a;

  /* Focus */
  --focus-ring: #6c5ce7;
}

[data-theme="dark"] {
  /* Surfaces */
  --surface-page:     #12111f;
  --surface-card:     #1a182c;
  --surface-card-alt: #232140;

  /* Texte */
  --text-primary:   #f4f3ff;
  --text-secondary: rgba(244, 243, 255, 0.66);
  --text-muted:     rgba(244, 243, 255, 0.44);
  --text-accent:    #9585ff;

  /* Accent indigo dark */
  --accent:       #7c6cf0;
  --accent-hover: #9585ff;
  --accent-soft:  #b3a7ff;

  /* Mint dark */
  --mint:         #4fd1a5;
  --mint-soft:    rgba(79, 209, 165, 0.15);

  /* Borders */
  --border-subtle:  rgba(244, 243, 255, 0.09);
  --border-default: rgba(244, 243, 255, 0.18);

  /* Actions */
  --action-primary:       #7c6cf0;
  --action-primary-text:  #ffffff;
  --action-primary-hover: #9585ff;
  --action-accent:        #7c6cf0;
  --action-accent-text:   #ffffff;

  /* Statuts dark */
  --status-sent-bg:    rgba(244, 243, 255, 0.07);
  --status-sent-text:  rgba(244, 243, 255, 0.50);
  --status-sent-dot:   rgba(244, 243, 255, 0.30);

  --status-opened-bg:   rgba(245, 158, 11, 0.12);
  --status-opened-text: #fcd34d;
  --status-opened-dot:  #f59e0b;

  --status-viewed-bg:   rgba(99, 102, 241, 0.15);
  --status-viewed-text: #a5b4fc;
  --status-viewed-dot:  #6366f1;

  --status-signed-bg:   rgba(79, 209, 165, 0.12);
  --status-signed-text: #6ee7b7;
  --status-signed-dot:  #4fd1a5;

  /* Focus */
  --focus-ring: #9585ff;
}

/* ── Base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Poppins', 'Helvetica Neue', Arial, sans-serif;
  background: var(--surface-page);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Scrollbar ── */
* { scrollbar-width: thin; scrollbar-color: var(--border-default) transparent; }
*::-webkit-scrollbar { width: 6px; }
*::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 3px; }

/* ── Animations ── */
@keyframes nb-rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes nb-grow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.animate-rise { animation: nb-rise 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
```

---

## 3. index.html — Script anti-flash thème

```html
<!-- index.html — premier script dans <body>, AVANT #root -->
<script>
  (function() {
    var t = localStorage.getItem('woui-theme')
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = t;
  })();
</script>
```

---

## 4. COMPOSANTS — Styles à appliquer

### Header (src/components/layout/Header.tsx)

```tsx
// height: 68px, sticky top-0, z-40
// background: var(--surface-page)
// border-bottom: 1px solid var(--border-subtle)
// padding: 0 clamp(1rem, 4vw, 34px)

// Logo : carré 32px background var(--accent) border-radius 3px + img logo
// "Woui" : font-size 19px, font-weight 600, color var(--text-primary)

// Nav pills :
//   Actif   → background: var(--surface-card-alt), color: var(--text-primary)
//   Inactif → background: transparent, color: var(--text-muted)
//   disabled (Statistiques) → opacity: 0.45, cursor: not-allowed
//   Style commun : padding 8px 16px, border-radius 3px, font-size 0.8125rem

// Bouton "+ Nouveau consentement" :
//   background: var(--action-accent)   → indigo #6c5ce7
//   color: var(--action-accent-text)   → blanc
//   border-radius: 3px, padding: 6px 14px, font-weight: 600, font-size: 0.8125rem

// Bouton thème (toggle dark/light) :
//   36×36px, border: 1px solid var(--border-subtle), border-radius: 3px
//   onClick → toggle data-theme sur <html> + localStorage.setItem('woui-theme', ...)

// Avatar praticien :
//   34×34px cercle, background: var(--surface-card-alt)
//   border: 1px solid var(--border-subtle)
//   initiales en Poppins 500, color: var(--text-primary)
```

### Badge statuts (src/components/ui/Badge.tsx)

```tsx
// Utiliser les variables --status-* (jamais de couleurs en dur)
const STATUS_STYLES = {
  sent:   { bg: 'var(--status-sent-bg)',   text: 'var(--status-sent-text)',   dot: 'var(--status-sent-dot)'   },
  opened: { bg: 'var(--status-opened-bg)', text: 'var(--status-opened-text)', dot: 'var(--status-opened-dot)' },
  viewed: { bg: 'var(--status-viewed-bg)', text: 'var(--status-viewed-text)', dot: 'var(--status-viewed-dot)' },
  signed: { bg: 'var(--status-signed-bg)', text: 'var(--status-signed-text)', dot: 'var(--status-signed-dot)' },
}
// Style du badge :
// display: inline-flex; align-items: center; gap: 6px
// padding: 4px 10px; border-radius: 999px
// font-family: Poppins; font-size: 11px; font-weight: 500; letter-spacing: 0.04em
// dot : 5×5px cercle, background: var(--status-xxx-dot)
```

### Barres de progression

```tsx
// Conteneur : height 2-3px, background: var(--border-subtle), border-radius: 2px
// Fill       : background: var(--mint)  ← UNIQUEMENT pour progression/succès
//              ou var(--accent) pour quota/usage
// Animation  : transform-origin: left; animation: nb-grow 0.8s ease both
```

### Inputs / Selects

```tsx
// background: var(--surface-card-alt)
// border: 1px solid var(--border-subtle)
// border-radius: 3px
// padding: 12px 14px
// font-family: Poppins; font-size: 0.9375rem; color: var(--text-primary)
// focus → border-color: var(--accent); outline: 2px solid rgba(108,92,231,0.2)
// placeholder → color: var(--text-muted)
```

### Boutons

```tsx
// Primary (action principale) :
//   background: var(--action-primary); color: var(--action-primary-text)
//   hover: background: var(--action-primary-hover)
//   border-radius: 3px; padding: 10px 20px; font-weight: 600

// Ghost (secondaire) :
//   background: transparent
//   border: 1px solid var(--border-default); color: var(--text-secondary)
//   hover: background: var(--surface-card-alt)

// Disabled : opacity: 0.45; cursor: not-allowed
```

### Cards

```tsx
// background: var(--surface-card)
// border: 1px solid var(--border-subtle)
// border-radius: 4px
// box-shadow: aucun (design flat)
// hover sur lignes tableau → background: var(--surface-card-alt)
```

---

## 5. FICHIERS À MODIFIER (liste exhaustive)

```
index.html
  → <link> Poppins dans <head>
  → script anti-flash dans <body> avant #root

src/index.css
  → Remplacer TOUT par le CSS de la section 2

tailwind.config.js (ou ts)
  → fontFamily.sans: ['Poppins', ...]

src/components/layout/Header.tsx
  → bouton thème : toggle data-theme + localStorage

src/components/ui/Badge.tsx
  → utiliser --status-* variables

src/components/ui/Button.tsx
  → couleurs via variables (plus de #0ea5e9, #6366f1 ou autre en dur)

src/components/ui/Input.tsx
  → focus ring via --accent

src/components/dashboard/StatsGrid.tsx
  → chiffres : Poppins 600, font-variant-numeric: tabular-nums
  → barre usage : --accent; barre progression : --mint

src/components/dashboard/ConsentsTable.tsx
  → hover rows : --surface-card-alt
  → badges : composant Badge avec --status-*

src/components/dashboard/SendModal.tsx
  → inputs, bouton primary : variables ci-dessus

src/pages/LoginPage.tsx
  → bouton : --action-primary (indigo)
  → fond : --surface-page

src/pages/SettingsPage.tsx
  → tab actif : border-left 2px --accent, background --surface-card-alt
  → barre quota : --accent
  → barre progression signatures : --mint

src/pages/SignaturePage.tsx
  → bouton Signer : --action-primary
  → barre vidéo : --mint
  → canvas border : --border-default, focus --accent
```

---

## 6. CE QUI NE CHANGE PAS

```
src/hooks/useAuth.ts          ← ne pas toucher
src/hooks/useConsents.ts      ← ne pas toucher
src/lib/supabase.ts           ← ne pas toucher
src/lib/constants.ts          ← libellés STATUS inchangés, seules les classes couleur
src/types/index.ts            ← ne pas toucher
src/App.tsx                   ← routing intact
supabase/functions/           ← ne pas toucher
```

---

## 7. INSTRUCTION CLAUDE CODE

```
Applique cette spec design dans le projet woui-app.
Commence par : index.html (Poppins + script thème), puis src/index.css
(remplace tout), puis tailwind.config, puis Header.tsx (toggle thème),
puis Badge.tsx, puis Button.tsx et Input.tsx, puis les pages dans l'ordre :
Dashboard, Settings, Login, Signature.

Règles strictes :
- Poppins partout, aucune autre police
- Toutes les couleurs via variables CSS, jamais de valeur hex en dur dans les composants
- data-theme="light|dark" sur <html>, persisté dans localStorage("woui-theme")
- --mint uniquement pour progression/succès, jamais comme fond de bloc
- --accent uniquement pour actions/liens, pas de second accent
- Ne touche pas aux hooks, types, lib, App.tsx, Edge Functions

Lance npm run dev à la fin et confirme qu'il n'y a aucune erreur TypeScript
et que le toggle dark/light fonctionne.
```
