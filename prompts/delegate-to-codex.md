# Prompt pour déléguer à Codex

Codex (CLI ou IDE OpenAI) lit automatiquement `AGENTS.md` à la racine. Le prompt à coller en début de session est donc plus court.

Copie-colle dans ta session Codex (lancée à la racine du kit décompressé) :

---

> Lis `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, puis `tasks/phase-0-bootstrap.md`.
>
> Implémente la phase 0 dans un sous-dossier `app/`. À la fin :
> - Lance `pnpm tsc --noEmit` et `pnpm tauri dev`.
> - Commit `feat(phase-0): bootstrap`.
> - Stoppe et fais-moi un récapitulatif.

---

## Notes spécifiques Codex

- Codex respecte mieux les contraintes formulées en listes à puces que les paragraphes longs.
- Si tu utilises Codex en CLI, ajoute `--auto-approve` avec prudence : pour les commandes shell de bootstrap (`pnpm install`, etc.), c'est ok ; pour les modifications de système, refuse.
- Codex est moins bon que Claude sur les choix d'architecture en cours de route. Reste sur les rails du `ROADMAP.md` et n'autorise pas d'écarts.

## Mode parallèle (Claude + Codex)

Tu peux faire travailler les deux sur des branches Git différentes :
- Claude → branche `feat/phases-0-2` (bootstrap, audio loading, audio engine — partie où l'architecture compte le plus)
- Codex → branche `feat/phases-3-4` (UI 3D, timeline — partie plus mécanique)

Puis tu fusionnes manuellement.

## Mode parallèle inversé

Une autre stratégie qui marche bien : Claude fait la **review** de ce que Codex produit. Lance Codex pour implémenter une phase, puis ouvre Claude Code et dis :

> Lis `tasks/phase-3-spatial-ui.md` et la branche actuelle. Vérifie que l'implémentation respecte la spec et l'architecture. Liste écarts, bugs potentiels, et suggestions concrètes. N'écris pas de code.
