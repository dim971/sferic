# Prompt pour déléguer à Claude Code

Copie-colle le bloc ci-dessous dans ta session Claude Code (lancée à la racine du kit décompressé) :

---

> Tu es chargé de construire l'application **Sferic** définie dans ce dépôt.
>
> Lis dans cet ordre :
> 1. `README.md`
> 2. `ARCHITECTURE.md`
> 3. `DESIGN.md` + l'image dans `design/` (source de vérité visuelle)
> 4. `ROADMAP.md`
> 5. `CLAUDE.md` (tes règles de fonctionnement)
>
> Puis attaque la **phase 0** en suivant `tasks/phase-0-bootstrap.md`. Crée le projet dans un sous-dossier `app/`.
>
> À la fin de chaque phase :
> - Lance `pnpm tsc --noEmit` et `pnpm tauri dev` pour valider.
> - Fais un commit `feat(phase-N): <résumé>`.
> - **Arrête-toi et résume ce que tu as fait, ce qui marche, ce qui reste à valider.** N'enchaîne pas la phase suivante sans mon feu vert.
>
> Si tu hésites sur un choix qui n'est pas couvert par les docs, demande plutôt que de présumer. Si tu veux ajouter une dépendance non listée dans `ARCHITECTURE.md`, demande d'abord.
>
> Commence maintenant : confirme la lecture des 4 documents et lance la phase 0.

---

## Variantes

### Mode "enchaîne tout"
Si tu lui fais entièrement confiance ou veux laisser tourner :

> ... Vas-y, enchaîne les 9 phases sans t'arrêter, mais commit à chaque phase et signale tout problème majeur. Je validerai à la fin.

### Mode "phase isolée"
Si tu veux qu'il ne fasse qu'une phase précise :

> Lis `README.md`, `ARCHITECTURE.md`, et `tasks/phase-3-spatial-ui.md`. Implémente uniquement la phase 3 dans `app/`, en supposant que les phases 0–2 sont déjà faites. Stoppe à la fin.

### Mode "review"
Pour faire relire ce qui existe :

> Lis tout le dépôt et fais-moi une revue critique de l'architecture, des choix techno et du roadmap. Pointe les risques, les zones floues, les dépendances obsolètes éventuelles, sans encore écrire de code.
