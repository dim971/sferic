# Phase 0 — Project bootstrap

## Goal

Create the Tauri 2 + React + TypeScript + Tailwind skeleton inside an `app/` subfolder.

## Steps

1. **Create the Tauri project** from the kit root:
   ```bash
   pnpm create tauri-app@latest
   ```
   Answers:
   - Project name: `app`
   - Identifier: `dev.sferic.app`
   - Frontend language: **TypeScript / JavaScript**
   - Package manager: **pnpm**
   - UI template: **React**
   - UI flavour: **TypeScript**

2. **Enter `app/` and install**:
   ```bash
   cd app
   pnpm install
   ```

3. **Add Tailwind CSS 4** (official Vite method):
   ```bash
   pnpm add -D tailwindcss @tailwindcss/vite
   ```
   - Edit `vite.config.ts` to add the `@tailwindcss/vite` plugin.
   - Create `src/index.css` with `@import "tailwindcss";`.
   - Import that CSS in `src/main.tsx`.

4. **Configure the `@/` alias**:
   - In `tsconfig.json`: `"baseUrl": ".", "paths": { "@/*": ["./src/*"] }`.
   - In `vite.config.ts`: `resolve.alias = { "@": path.resolve(__dirname, "./src") }`.

5. **Enable TypeScript strict mode** in `tsconfig.json` (default — verify).

6. **Install base runtime dependencies**:
   ```bash
   pnpm add zustand nanoid clsx
   ```

7. **Configure required Tauri 2 plugins**:
   ```bash
   pnpm tauri add dialog
   pnpm tauri add fs
   ```
   This adds the Rust crates and default permissions.

8. **Restrict permissions** in `src-tauri/capabilities/default.json`:
   ```json
   {
     "$schema": "../gen/schemas/desktop-schema.json",
     "identifier": "default",
     "description": "Default capabilities for Sferic",
     "windows": ["main"],
     "permissions": [
       "core:default",
       "dialog:allow-open",
       "dialog:allow-save",
       "fs:allow-read-text-file",
       "fs:allow-write-text-file",
       "fs:allow-read-file",
       "fs:allow-write-file"
     ]
   }
   ```

9. **Declare the colour tokens** in `src/index.css` (see `DESIGN.md §1.1`). After `@import "tailwindcss";`, add a Tailwind 4 `@theme` block (or `:root`) with **all** listed tokens (`--bg-base`, `--bg-panel`, `--accent`, `--listener`, etc.). These tokens are used from this phase onward — do not redefine them elsewhere.

10. **Replace `src/App.tsx`** with a clean placeholder that already uses the tokens:
    ```tsx
    export default function App() {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[--bg-base] text-[--text-primary]">
          <h1 className="text-3xl font-light tracking-tight">Sferic</h1>
        </div>
      );
    }
    ```

11. **Update `tauri.conf.json`**:
    - `productName`: `Sferic`
    - `version`: `0.1.0`
    - Window: `width: 1280, height: 800, minWidth: 1024, minHeight: 700, title: "Sferic"`

12. **Create the target folder structure** under `app/src/`:
    ```
    src/
    ├── components/
    │   ├── layout/
    │   ├── scene/
    │   ├── timeline/
    │   ├── transport/
    │   └── inspector/
    ├── lib/
    │   ├── audio-engine.ts
    │   ├── wav-encoder.ts
    │   └── math3d.ts
    ├── store/
    │   └── project-store.ts
    ├── types/
    │   └── project.ts
    ├── App.tsx
    ├── main.tsx
    └── index.css
    ```
    Create empty files at this stage (just a `// TODO` placeholder); they'll be filled in later phases.

## Design

The placeholder has almost nothing to show, but the **palette must be in place from this phase**: all `DESIGN.md §1.1` tokens are declared in `src/index.css`, and `App.tsx` uses `bg-[--bg-base]` + `text-[--text-primary]`. Open `design/Screenshot 2026-05-09 at 08.53.47.png` once to calibrate your eye on the expected black tone (very dark, slightly bluish).

## Acceptance criterion

- `pnpm tauri dev` starts a native window with title "Sferic" and the centred placeholder.
- Background is `--bg-base` (≈ `#07080A`) and text is `--text-primary` — no default Tailwind grey.
- No errors in the console (browser or Rust).
- `pnpm tsc --noEmit` passes.

## Commit

```
feat(phase-0): bootstrap Tauri 2 + React + TS + Tailwind
```
