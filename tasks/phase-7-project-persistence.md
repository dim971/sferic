# Phase 7 — Sauvegarde et chargement de projets

## Objectif

Permettre à l'utilisateur de sauvegarder un projet (audio + keyframes + settings) dans un fichier `.sferic.json` et de le rouvrir plus tard.

## Étapes

1. **Format de fichier** : `.sferic.json`
   - Structure exactement celle de l'interface `Project` (cf. `types/project.ts`).
   - **Le fichier audio n'est PAS embarqué**. Seul le chemin original est stocké. Au chargement :
     - On essaie d'ouvrir le chemin original.
     - S'il n'existe plus (fichier déplacé), on demande à l'utilisateur de localiser le fichier audio.

2. **Action `saveProject(path)`** dans le store :
   ```ts
   saveProject: async (path: string) => {
     const { project } = get();
     if (!project) return;
     project.meta.updatedAt = new Date().toISOString();
     await writeTextFile(path, JSON.stringify(project, null, 2));
   }
   ```

3. **Action `loadProject(path)`** dans le store :
   ```ts
   loadProject: async (path: string) => {
     const json = await readTextFile(path);
     const project: Project = JSON.parse(json);
     // Validation minimale
     if (project.version !== 1) throw new Error('Version de projet incompatible');
     // Charger l'audio
     let audioPath = project.audioFile.originalPath;
     if (!(await exists(audioPath))) {
       const picked = await open({ title: 'Localiser le fichier audio', filters: [...] });
       if (!picked) throw new Error('Fichier audio introuvable');
       audioPath = picked as string;
     }
     const bytes = await readFile(audioPath);
     const buffer = await AudioEngine.decode(bytes.buffer);
     set({ project, audioBuffer: buffer });
   }
   ```

4. **UI** (cf. `DESIGN.md §3`) :
   - Activer les boutons `Save` et `Open` du Topbar (déjà présents depuis phase 1).
     - `Open` ouvre un menu déroulant à deux choix : `Open audio…` (chargement audio existant) et `Open project…` (chargement `.sferic.json`). Par défaut le clic ouvre `Open project…` ; un sub-menu présente l'autre option.
     - `Save` sauvegarde le projet courant. `Cmd/Ctrl+Shift+S` → save as.
   - Le menu `File` du Topbar reprend les actions complètes (`Open audio…`, `Open project…`, `Save`, `Save as…`, `Export…`).
   - Stocker `currentProjectPath` dans le store.
   - Afficher dans le titre de fenêtre Tauri : `Sferic — <nom du projet>` (sans le `• modifié` puisque le chip UNSAVED dans le Topbar joue ce rôle).

5. **Chip UNSAVED** (cf. `DESIGN §3` point 4) :
   - Booléen `isDirty` dans le store, mis à `true` après chaque action mutative (`addKeyframe`, `updateKeyframe`, `removeKeyframe`, modification settings, etc.).
   - Réinitialisé à `false` après `saveProject` réussi.
   - Le chip `UNSAVED` (`bg-[--accent-soft] text-[--accent] text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md`) n'est rendu que si `isDirty === true`. Sinon il disparaît complètement du Topbar (pas masqué, retiré du flow).
   - Au close de la fenêtre, si `isDirty`, demander confirmation via `dialog.ask` du plugin Tauri.

6. **Validation et migration** :
   - Préparer une fonction `migrateProject(raw: unknown): Project` qui :
     - Valide la structure (utiliser `zod` recommandé).
     - Migre les anciennes versions si on en crée plus tard.
   - Pour l'instant, version 1 uniquement.
   - `pnpm add zod`.

## Design

Réf : `DESIGN.md §3` (chip UNSAVED, boutons Save/Open). Le chip UNSAVED apparaît/disparaît proprement (pas de flicker, pas de placeholder vide). Les boutons Save/Open restent en outline orange — uniformes avec l'identité visuelle.

## Critère d'acceptation

- Charger un audio, ajouter 5 keyframes avec différentes courbes, sauver dans `test.sferic.json`.
- Quitter et relancer l'app. Ouvrir `test.sferic.json` → tout est restauré : audio chargé, keyframes au bon endroit, settings préservés.
- Si on déplace l'audio entre temps, l'app demande à le relocaliser.
- Le titre de fenêtre se met à jour correctement.
- Le chip UNSAVED apparaît dès la première modification, disparaît à la sauvegarde.
- `Cmd/Ctrl+S` sauvegarde sans dialogue si le projet a déjà un chemin.

## Commit

```
feat(phase-7): sauvegarde/chargement de projets .sferic.json
```
