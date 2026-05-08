# Roadmap — 9 phases d'exécution

Chaque phase est **livrable indépendamment** et a un critère d'acceptation clair. Ne passe pas à la phase suivante tant que les critères ne sont pas remplis.

| Phase | Objectif | Fichier détaillé | Durée estimée (agent) |
|---|---|---|---|
| 0 | Bootstrap projet Tauri + React + TS + Tailwind | `tasks/phase-0-bootstrap.md` | 30 min |
| 1 | Charger un fichier audio et afficher sa forme d'onde | `tasks/phase-1-audio-loading.md` | 1 h |
| 2 | Moteur audio Web Audio API + lecture stéréo simple | `tasks/phase-2-audio-engine.md` | 1 h |
| 3 | Scène 3D Three.js avec auditeur fixe + sphère + ajout de keyframes | `tasks/phase-3-spatial-ui.md` | 2 h |
| 4 | Timeline avec marqueurs synchronisés et édition de keyframes | `tasks/phase-4-timeline-keyframes.md` | 1.5 h |
| 5 | Lecture temps réel avec spatialisation HRTF automatisée | `tasks/phase-5-realtime-preview.md` | 1.5 h |
| 6 | Export offline en WAV / MP3 stéréo avec effet bakké | `tasks/phase-6-offline-render.md` | 1.5 h |
| 7 | Sauvegarde / chargement de projets `.spatialize.json` | `tasks/phase-7-project-persistence.md` | 1 h |
| 8 | Build cross-platform et CI GitHub Actions | `tasks/phase-8-distribution.md` | 1 h |

**Total estimé** : ~11 heures d'agent autonome avec validation humaine entre chaque phase.

## Règles globales

1. **Tester à la fin de chaque phase** : `pnpm tauri dev` doit démarrer sans erreur.
2. **Commits atomiques par phase** : un commit `feat(phase-N): …` à la fin de chaque phase.
3. **TypeScript strict** : `"strict": true`, pas de `any` sauf justifié en commentaire.
4. **Pas de bibliothèque non listée dans `ARCHITECTURE.md` sans demander**.
5. **Conserver le découpage de composants** indiqué dans l'architecture.
6. **Pour Tauri 2** : utiliser uniquement la v2 (pas de mélange v1/v2).
7. **Toujours utiliser pnpm** (pas npm/yarn) pour rester cohérent avec les locks.

## Préparation utilisateur (avant phase 0)

Vérifier sur la machine cible :

```bash
node -v        # ≥ 20
rustc --version # ≥ 1.77
pnpm -v        # n'importe quelle version récente
```

Et installer les dépendances système pour Tauri 2 selon l'OS :
[https://v2.tauri.app/start/prerequisites/](https://v2.tauri.app/start/prerequisites/)
