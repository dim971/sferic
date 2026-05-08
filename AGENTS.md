# AGENTS.md — Instructions pour Codex

Ce fichier suit la convention `AGENTS.md` reconnue par Codex et les agents OpenAI.

## Mission

Implémenter l'application **Spatialize** : un outil desktop multiplateforme (macOS, Windows, Linux) qui permet de spatialiser un fichier audio dans le temps via une interface visuelle 3D.

## Sources de vérité (à lire en premier)

| Fichier | Contenu |
|---|---|
| `README.md` | Vision, stack technique, justification |
| `ARCHITECTURE.md` | Modèle de données, graphe audio, composants React, IPC |
| `ROADMAP.md` | 9 phases, durée, ordre |
| `tasks/phase-N-*.md` | Spec détaillée de chaque phase |

## Stack technique imposée

- **Tauri 2** (Rust shell)
- **React 18** + **TypeScript strict** + **Vite**
- **Three.js** via `@react-three/fiber` + `@react-three/drei`
- **wavesurfer.js v7** pour la timeline
- **Web Audio API** natif pour le moteur audio (PannerNode HRTF)
- **Zustand** pour le state
- **Tailwind CSS 4**
- **pnpm** comme gestionnaire de paquets
- Crates Rust : `symphonia` (décodage), `hound` (encodage WAV)

Ne pas substituer ces choix sans demander.

## Workflow par phase

1. Lis `tasks/phase-N-*.md`.
2. Implémente.
3. Vérifie le critère d'acceptation.
4. Lance `pnpm tsc --noEmit` et `pnpm tauri dev` pour valider.
5. Commit : `feat(phase-N): <résumé>`.
6. Stoppe et demande validation humaine.

## Conventions

- Composants React fonctionnels, hooks, pas de classes (sauf `AudioEngine` singleton).
- Imports absolus avec alias `@/` → `app/src/`.
- Pas d'`any` TypeScript.
- Un fichier = un composant.
- Tailwind utility-first.
- Tests : Vitest pour les utilitaires (waveform, encoder, math 3D).

## Sécurité Tauri

- Allowlist (capability) minimale : seulement `dialog:open`, `dialog:save`, `fs:read`, `fs:write` limitées au dossier projet et au home utilisateur.
- Pas de `shell:execute` ni d'API réseau.

## Premier message attendu de toi

1. Confirme la lecture des 4 sources de vérité.
2. Annonce le démarrage de la **phase 0** (`tasks/phase-0-bootstrap.md`).
