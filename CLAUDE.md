# Instructions pour Claude Code

Tu es chargé d'implémenter l'application **Sferic** décrite dans ce dépôt.

## Mission

Construire un outil desktop multiplateforme (macOS, Windows, Linux) qui permet de spatialiser un fichier audio dans le temps via une interface visuelle 3D, en se basant sur le Web Audio API (`PannerNode` HRTF).

## Documents à lire dans cet ordre

1. `README.md` — vue d'ensemble et choix techno
2. `ARCHITECTURE.md` — modèle de données, graphe audio, composants
3. `DESIGN.md` — système visuel + image cible dans `design/` (source de vérité pour tout rendu)
4. `ROADMAP.md` — découpage en 9 phases
5. `tasks/phase-0-bootstrap.md` — première tâche

## Méthodologie

- **Travaille phase par phase**, en suivant strictement les fichiers `tasks/phase-N-*.md`.
- À la fin de chaque phase, **arrête-toi** et demande validation humaine avant de continuer (sauf si l'utilisateur t'a explicitement dit « enchaîne tout »).
- Crée le projet dans un sous-dossier `app/` à la racine du kit.
- Utilise **pnpm** comme gestionnaire de paquets.
- Utilise **Tauri 2** (jamais Tauri 1).
- TypeScript en mode `strict`.

## Conventions de code

- React : composants fonctionnels uniquement, hooks.
- Pas de classe sauf pour `AudioEngine` (singleton).
- Imports absolus depuis `@/` (configurer dans `tsconfig.json` et `vite.config.ts`).
- Tailwind utility-first ; pas de CSS modules sauf cas exceptionnel.
- Nommage : `PascalCase` pour composants, `camelCase` pour fonctions/variables, `SCREAMING_SNAKE_CASE` pour constantes globales.
- Un fichier par composant React.

## Vérifications obligatoires à la fin de chaque phase

1. `pnpm install` passe sans warning critique.
2. `pnpm tauri dev` démarre l'app sans erreur console.
3. Le critère d'acceptation de la phase est rempli (testable manuellement).
4. `pnpm tsc --noEmit` ne retourne aucune erreur.
5. Commit créé avec le message `feat(phase-N): <résumé>`.

## Quand demander confirmation

- Avant d'ajouter une dépendance non listée dans `ARCHITECTURE.md` ou `DESIGN.md`.
- Avant de modifier le découpage de composants.
- Avant de toucher à la configuration de Tauri (sécurité, allowlist).
- Avant de t'écarter visiblement du screenshot dans `design/` (couleurs, layout, hiérarchie).
- Si une instruction d'une `tasks/phase-N` te semble contradictoire avec l'`ARCHITECTURE.md` ou `DESIGN.md`.

## Quand NE PAS demander

- Choix mineurs de naming, structure de dossier interne, formattage.
- Bibliothèques utilitaires courantes (ex : `clsx`, `nanoid`, `date-fns`).

## Premier message attendu de toi

Quand tu commences :
1. Confirme que tu as lu `README.md`, `ARCHITECTURE.md`, `DESIGN.md`, `ROADMAP.md` et regardé l'image dans `design/`.
2. Indique la version de Node, Rust et pnpm détectées.
3. Annonce que tu attaques la **phase 0** et ouvre `tasks/phase-0-bootstrap.md`.
