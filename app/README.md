# Spatialize

Outil desktop multiplateforme pour spatialiser un fichier audio dans le temps via une interface visuelle 3D et une lecture HRTF binaurale.

## Prérequis

- **Node.js ≥ 20**
- **Rust ≥ 1.77** (avec cargo)
- **pnpm** (`npm install -g pnpm`)
- Dépendances système Tauri 2 selon l'OS — voir https://v2.tauri.app/start/prerequisites/
  - **macOS** : Xcode Command Line Tools
  - **Windows** : Microsoft C++ Build Tools + WebView2 (auto)
  - **Linux** : `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev`

## Développement

```bash
pnpm install
pnpm tauri dev
```

Le port Vite est fixé à 1420 (`strictPort`). Si vous le voyez occupé après une session précédente, libérez-le :

```bash
lsof -nP -iTCP:1420 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs -r kill
```

## Vérifications avant commit

```bash
pnpm tsc --noEmit
pnpm tsc --noEmit -p tsconfig.node.json
```

## Build local

```bash
pnpm tauri build
```

Les binaires apparaissent dans `src-tauri/target/release/bundle/`.

## Release multiplateforme

Push d'un tag `v*` déclenche le workflow `.github/workflows/release.yml` qui produit en parallèle :

- macOS universal (`.dmg`, `.app`)
- Windows (`.msi`, `.exe`)
- Linux (`.AppImage`, `.deb`, `.rpm`)

Et publie un draft de release GitHub avec les artefacts attachés.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Notes plateformes

- **macOS sans Developer ID** : la première ouverture demande clic-droit → Ouvrir (Gatekeeper). Documentez-le pour vos utilisateurs ou signez l'app.
- **Linux** : le `.deb` dépend de `libwebkit2gtk-4.1-0` et `libssl3`. Les paquets de Debian/Ubuntu récents les fournissent.
- **Windows** : WebView2 est embarqué via `webviewInstallMode: embedBootstrapper`.

## Architecture

Voir `../ARCHITECTURE.md` (graphe audio + composants) et `../DESIGN.md` (système visuel) à la racine du kit.
