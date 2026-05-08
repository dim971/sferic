# Phase 0 — Bootstrap du projet

## Objectif

Créer le squelette Tauri 2 + React + TypeScript + Tailwind dans un sous-dossier `app/`.

## Étapes

1. **Créer le projet Tauri** depuis la racine du kit :
   ```bash
   pnpm create tauri-app@latest
   ```
   Réponses :
   - Project name : `app`
   - Identifier : `dev.spatialize.app`
   - Language for Frontend : **TypeScript / JavaScript**
   - Package manager : **pnpm**
   - UI template : **React**
   - UI flavor : **TypeScript**

2. **Entrer dans `app/` et installer** :
   ```bash
   cd app
   pnpm install
   ```

3. **Ajouter Tailwind CSS 4** (méthode officielle Vite) :
   ```bash
   pnpm add -D tailwindcss @tailwindcss/vite
   ```
   - Modifier `vite.config.ts` pour ajouter le plugin `@tailwindcss/vite`.
   - Créer `src/index.css` avec `@import "tailwindcss";`.
   - Importer ce CSS dans `src/main.tsx`.

4. **Configurer l'alias `@/`** :
   - Dans `tsconfig.json` : `"baseUrl": ".", "paths": { "@/*": ["./src/*"] }`.
   - Dans `vite.config.ts` : `resolve.alias = { "@": path.resolve(__dirname, "./src") }`.

5. **Activer le mode strict TypeScript** dans `tsconfig.json` (déjà par défaut, vérifier).

6. **Installer les dépendances de runtime de base** :
   ```bash
   pnpm add zustand nanoid clsx
   ```

7. **Configurer les plugins Tauri 2 nécessaires** :
   ```bash
   pnpm tauri add dialog
   pnpm tauri add fs
   ```
   Cela ajoute les crates côté Rust et les permissions par défaut.

8. **Limiter les permissions** dans `src-tauri/capabilities/default.json` :
   ```json
   {
     "$schema": "../gen/schemas/desktop-schema.json",
     "identifier": "default",
     "description": "Default capabilities for Spatialize",
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

9. **Remplacer le contenu de `src/App.tsx`** par un placeholder propre :
   ```tsx
   export default function App() {
     return (
       <div className="h-screen w-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
         <h1 className="text-3xl font-light tracking-tight">Spatialize</h1>
       </div>
     );
   }
   ```

10. **Mettre à jour `tauri.conf.json`** :
    - `productName` : `Spatialize`
    - `version` : `0.1.0`
    - Window : `width: 1280, height: 800, minWidth: 1024, minHeight: 700, title: "Spatialize"`

11. **Créer la structure de dossiers cible** dans `app/src/` :
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
    Crée des fichiers vides à ce stade (juste le placeholder `// TODO`), ils seront remplis aux phases suivantes.

## Critère d'acceptation

- `pnpm tauri dev` démarre une fenêtre native avec le titre "Spatialize" et le placeholder centré.
- Pas d'erreur dans la console (browser ni Rust).
- `pnpm tsc --noEmit` passe.

## Commit

```
feat(phase-0): bootstrap Tauri 2 + React + TS + Tailwind
```
