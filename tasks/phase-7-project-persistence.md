# Phase 7 — Save and load projects

## Goal

Let the user save a project (audio + keyframes + settings) to a `.sferic.json` file and reopen it later.

## Steps

1. **File format**: `.sferic.json`
   - Structure exactly matches the `Project` interface (see `types/project.ts`).
   - **The audio file is NOT embedded**. Only the original path is stored. On load:
     - We try to open the original path.
     - If it no longer exists (file moved), we ask the user to locate the audio file.

2. **`saveProject(path)` action** in the store:
   ```ts
   saveProject: async (path: string) => {
     const { project } = get();
     if (!project) return;
     project.meta.updatedAt = new Date().toISOString();
     await writeTextFile(path, JSON.stringify(project, null, 2));
   }
   ```

3. **`loadProject(path)` action** in the store:
   ```ts
   loadProject: async (path: string) => {
     const json = await readTextFile(path);
     const project: Project = JSON.parse(json);
     // Minimal validation
     if (project.version !== 1) throw new Error('Incompatible project version');
     // Load audio
     let audioPath = project.audioFile.originalPath;
     if (!(await exists(audioPath))) {
       const picked = await open({ title: 'Locate audio file', filters: [...] });
       if (!picked) throw new Error('Audio file not found');
       audioPath = picked as string;
     }
     const bytes = await readFile(audioPath);
     const buffer = await AudioEngine.decode(bytes.buffer);
     set({ project, audioBuffer: buffer });
   }
   ```

4. **UI** (see `DESIGN.md §3`):
   - Activate the Topbar's `Save` and `Open` buttons (already present since phase 1).
     - `Open` opens a dropdown with two choices: `Open audio…` (load existing audio) and `Open project…` (load `.sferic.json`). By default the click opens `Open project…`; a sub-menu shows the other option.
     - `Save` saves the current project. `Cmd/Ctrl+Shift+S` → save as.
   - The Topbar's `File` menu lists the full actions (`Open audio…`, `Open project…`, `Save`, `Save as…`, `Export…`).
   - Store `currentProjectPath` in the store.
   - Show in the Tauri window title: `Sferic — <project name>` (without the `• modified` suffix since the UNSAVED chip in the Topbar plays that role).

5. **UNSAVED chip** (see `DESIGN §3` point 4):
   - `isDirty` boolean in the store, set to `true` after each mutating action (`addKeyframe`, `updateKeyframe`, `removeKeyframe`, settings change, etc.).
   - Reset to `false` after a successful `saveProject`.
   - The `UNSAVED` chip (`bg-[--accent-soft] text-[--accent] text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md`) is only rendered when `isDirty === true`. Otherwise it disappears entirely from the Topbar (not hidden, removed from the flow).
   - On window close, if `isDirty`, ask for confirmation via the Tauri plugin's `dialog.ask`.

6. **Validation and migration**:
   - Prepare a `migrateProject(raw: unknown): Project` function that:
     - Validates the structure (using `zod` is recommended).
     - Migrates older versions if we ever create more.
   - For now, version 1 only.
   - `pnpm add zod`.

## Design

Ref: `DESIGN.md §3` (UNSAVED chip, Save/Open buttons). The UNSAVED chip appears/disappears cleanly (no flicker, no empty placeholder). The Save/Open buttons stay orange outline — uniform with the visual identity.

## Acceptance criterion

- Load an audio file, add 5 keyframes with different curves, save to `test.sferic.json`.
- Quit and relaunch the app. Open `test.sferic.json` → everything is restored: audio loaded, keyframes in the right place, settings preserved.
- If the audio is moved meanwhile, the app prompts to relocate it.
- The window title updates correctly.
- The UNSAVED chip appears at the first edit, disappears on save.
- `Cmd/Ctrl+S` saves without a dialog if the project already has a path.

## Commit

```
feat(phase-7): save/load .sferic.json projects
```
