@.claude/conventions.md

# idee — notes pour Claude Code

Éditeur de notes (https://idee-neon.vercel.app/). App Next.js / React /
TypeScript / Tailwind (`app/app/App.tsx` + composants dans
`app/app/components/`), styles globaux dans `app/globals.css`. Catégorie :
**primaire**. Cible : mobile et bureau.

## Parité visuelle avec Source (IMPORTANT)

idee et `supershivas/source` doivent avoir **exactement la même sidebar**
(espacements, dividers, tailles d'icônes, hauteurs de bouton, etc.) — seul le
contenu/la fonction change. Si tu modifies un style de sidebar ici
(`App.tsx`, `SearchBar.tsx`, etc.), vérifie toujours son équivalent dans
source et applique le même changement des deux côtés dans la même session.
Ne jamais laisser les deux diverger.

La sidebar est "toujours sombre" indépendamment du thème clair/sombre de
l'app — les variables `--sidebar-*` dans `globals.css` doivent rester
identiques entre les blocs Light et Dark de `:root`.

## Design tokens

Source de vérité canonique : `supershivas/design-system` (`design-tokens.json`).
Toute valeur partagée (couleurs sidebar, radii, fonts, dimensions
search/kbd/header/divider) doit être modifiée **là-bas en premier**, puis
synchronisée ici par `scripts/sync-design-system.sh` (lancé automatiquement
au début de chaque session, avec `app/mobile.css`), puis reportée dans
`app/globals.css` / les classNames-styles inline qui la consomment. Ne jamais
modifier une valeur partagée uniquement ici sans la reporter dans
design-system et dans source.

## Versioning

Conforme aux conventions : `public/version.json` est la seule source de
vérité, `public/CHANGELOG.md` l'historique. `next.config.js` les lit au build
et expose `NEXT_PUBLIC_APP_VERSION` et `NEXT_PUBLIC_APP_CHANGELOG` (5
dernières versions, affichées dans Réglages par `Changelog.tsx`). La date
affichée à côté de la version reste celle du commit courant, lue au build.

**Toujours rappeler le numéro de version** dans la réponse à l'utilisateur,
à chaque fois qu'un changement est livré.

Mise à jour : `PwaUpdater` compare l'identifiant de build servi par
`/api/build-id` (au retour au premier plan et toutes les 5 minutes) et
recharge dès qu'aucune saisie n'est en cours ; `VersionToast` annonce ensuite
« Mis à jour en vX.Y.Z ».

## Exceptions aux conventions

Aucune.
