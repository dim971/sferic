# Phase 7 — Sauvegarde et chargement de projets

## Objectif

Permettre à l'utilisateur de sauvegarder un projet (audio + keyframes + settings) dans un fichier `.spatialize.json` et de le rouvrir plus tard.

## Étapes

1. **Format de fichier** : `.spatialize.json`
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

4. **UI** :
   - Topbar : boutons "Ouvrir projet…", "Enregistrer", "Enregistrer sous…", "Exporter…"
   - Raccourcis clavier :
     - `Cmd/Ctrl+S` → save (utilise le `currentProjectPath` ou prompt)
     - `Cmd/Ctrl+Shift+S` → save as
     - `Cmd/Ctrl+O` → open project
   - Stocker `currentProjectPath` dans le store.
   - Afficher dans le titre de fenêtre : `Spatialize — <nom du projet> [• modifié]`.

5. **Marqueur "modifié"** :
   - Booléen `isDirty` dans le store, mis à `true` après chaque action mutative.
   - Réinitialisé à `false` après `saveProject`.
   - Au close de la fenêtre, si `isDirty`, demander confirmation via `dialog.ask` du plugin Tauri.

6. **Validation et migration** :
   - Préparer une fonction `migrateProject(raw: unknown): Project` qui :
     - Valide la structure (utiliser `zod` recommandé).
     - Migre les anciennes versions si on en crée plus tard.
   - Pour l'instant, version 1 uniquement.
   - `pnpm add zod`.

## Critère d'acceptation

- Charger un audio, ajouter 5 keyframes avec différentes courbes, sauver dans `test.spatialize.json`.
- Quitter et relancer l'app. Ouvrir `test.spatialize.json` → tout est restauré : audio chargé, keyframes au bon endroit, settings préservés.
- Si on déplace l'audio entre temps, l'app demande à le relocaliser.
- Le titre de fenêtre se met à jour correctement.
- `Cmd/Ctrl+S` sauvegarde sans dialogue si le projet a déjà un chemin.

## Commit

```
feat(phase-7): sauvegarde/chargement de projets .spatialize.json
```
