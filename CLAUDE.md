# idee — notes pour Claude Code

App Next.js / React / TypeScript / Tailwind (`app/app/App.tsx` + composants
dans `app/app/components/`), styles globaux dans `app/globals.css`.

## Parité visuelle avec La-fabrique (IMPORTANT)

idee et `supershivas/La-fabrique` doivent avoir **exactement la même sidebar**
(espacements, dividers, tailles d'icônes, hauteurs de bouton, etc.) — seul le
contenu/la fonction change. Si tu modifies un style de sidebar ici
(`App.tsx`, `SearchBar.tsx`, etc.), vérifie toujours son équivalent dans
La-fabrique (`index.html`, `style.css`, `app.js`) et applique le même
changement des deux côtés dans la même session/PR. Ne jamais laisser les deux
diverger.

La sidebar est "toujours sombre" indépendamment du thème clair/sombre de
l'app — les variables `--sidebar-*` dans `globals.css` doivent rester
identiques entre les blocs Light et Dark de `:root`.

## Design tokens

Source de vérité canonique : `supershivas/design-system` (`design-tokens.json`).
Toute valeur partagée (couleurs sidebar, radii, fonts, dimensions
search/kbd/header/divider) doit être modifiée **là-bas en premier**, puis
synchronisée ici via `./scripts/sync-tokens.sh`, puis reportée dans
`app/globals.css` / les classNames-styles inline qui la consomment. Ne jamais
modifier une valeur partagée uniquement ici sans la reporter dans
design-system et dans La-fabrique.

## Workflow Git

- Toujours brancher depuis `main`, jamais commit direct sur `main`.
- Commits descriptifs en français.
- Une fois la branche poussée : créer une PR vers `main`, puis squash-merge
  (`merge_method: "squash"`). C'est le pattern utilisé pour tout ce repo.
