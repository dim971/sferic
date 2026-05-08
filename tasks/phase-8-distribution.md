# Phase 8 — Build cross-platform et CI

## Objectif

Produire des binaires natifs pour macOS, Windows et Linux et automatiser ce build via GitHub Actions.

## Étapes

1. **Configurer le bundler** dans `src-tauri/tauri.conf.json` :
   ```json
   {
     "bundle": {
       "active": true,
       "targets": "all",
       "category": "Music",
       "shortDescription": "Spatialiser un fichier audio dans le temps",
       "longDescription": "Outil multiplateforme pour ajouter un effet 8D / spatialisation HRTF à un fichier audio via une interface visuelle 3D.",
       "icon": [
         "icons/32x32.png",
         "icons/128x128.png",
         "icons/128x128@2x.png",
         "icons/icon.icns",
         "icons/icon.ico"
       ],
       "macOS": { "minimumSystemVersion": "11.0" },
       "windows": { "webviewInstallMode": { "type": "embedBootstrapper" } },
       "linux": { "deb": { "depends": ["libwebkit2gtk-4.1-0", "libssl3"] } }
     }
   }
   ```

2. **Générer les icônes** : créer une icône SVG simple (sphère 3D stylisée + onde) et utiliser :
   ```bash
   pnpm tauri icon ./assets/icon.png
   ```

3. **Build local** pour valider sur la machine de dev :
   ```bash
   pnpm tauri build
   ```
   Vérifier que les binaires apparaissent dans `src-tauri/target/release/bundle/`.

4. **GitHub Actions** : créer `.github/workflows/release.yml` :
   ```yaml
   name: Release
   on:
     push:
       tags: ['v*']
   jobs:
     build:
       strategy:
         fail-fast: false
         matrix:
           include:
             - platform: macos-latest
               args: '--target universal-apple-darwin'
             - platform: ubuntu-22.04
               args: ''
             - platform: windows-latest
               args: ''
       runs-on: ${{ matrix.platform }}
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v3
           with: { version: 9 }
         - uses: actions/setup-node@v4
           with: { node-version: 20, cache: pnpm, cache-dependency-path: app/pnpm-lock.yaml }
         - uses: dtolnay/rust-toolchain@stable
           with: { targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }} }
         - name: Install Linux deps
           if: matrix.platform == 'ubuntu-22.04'
           run: |
             sudo apt-get update
             sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev
         - run: pnpm install
           working-directory: app
         - uses: tauri-apps/tauri-action@v0
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           with:
             projectPath: app
             tagName: ${{ github.ref_name }}
             releaseName: 'Spatialize ${{ github.ref_name }}'
             releaseDraft: true
             prerelease: false
             args: ${{ matrix.args }}
   ```

5. **Workflow CI** plus léger sur PR (`.github/workflows/ci.yml`) :
   ```yaml
   name: CI
   on: [push, pull_request]
   jobs:
     check:
       runs-on: ubuntu-22.04
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v3
           with: { version: 9 }
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - run: pnpm install
           working-directory: app
         - run: pnpm tsc --noEmit
           working-directory: app
         - run: pnpm test --run
           working-directory: app
           if: always()
   ```

6. **Documenter dans `app/README.md`** :
   - Comment installer les prérequis par OS.
   - Commandes : `pnpm install`, `pnpm tauri dev`, `pnpm tauri build`.
   - Comment créer un release : tag `v0.1.0` et push.

7. **Tester le binaire** sur au moins une plateforme (idéalement les trois si possible) :
   - L'app s'ouvre.
   - Charger un audio, ajouter keyframes, exporter.
   - Aucun warning d'antivirus / Gatekeeper bloquant.
   - **Note** : sur macOS, sans signature Developer ID, l'utilisateur doit clic-droit → Ouvrir la première fois. Documenter ça.

## Critère d'acceptation

- Les trois bundles sont produits localement (au moins sur la machine de dev).
- Le workflow CI passe au push.
- Le workflow Release crée un draft de release avec les artifacts attachés quand on tag `v0.1.0`.
- L'app installée fonctionne identiquement à `pnpm tauri dev`.

## Commit

```
feat(phase-8): build multiplateforme et CI GitHub Actions
chore: tag v0.1.0
```

---

🎉 **À ce stade, l'application est complète et distribuable.**

## Idées pour la suite (hors scope du roadmap initial)

- Effet **Doppler** automatique selon la vitesse de déplacement de la source.
- Multi-sources (plusieurs pistes spatialisées indépendamment).
- Import/export **Ambisonics** (B-format).
- Mode "trace" : dessiner un chemin dans l'espace au lieu de placer des keyframes.
- Preset de trajectoires (rotation horizontale, hélice descendante, etc.).
- Synchro MIDI pour piloter les positions depuis un contrôleur externe.
- Export **vidéo** (visualisation animée + audio) pour partage sur réseaux sociaux.
