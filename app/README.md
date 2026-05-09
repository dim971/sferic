# Sferic — application

Cross-platform desktop app for spatializing audio in time through a visual 3D interface with HRTF binaural playback. This folder contains the application itself; product overview lives in the [repository root README](../README.md).

## Prerequisites

- **Node.js ≥ 20**
- **Rust ≥ 1.77** (with cargo)
- **pnpm** (`npm install -g pnpm`)
- Tauri 2 system prerequisites per OS — see [v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/):
  - **macOS** — Xcode Command Line Tools
  - **Windows** — Microsoft C++ Build Tools + WebView2 (auto)
  - **Linux** — `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev`

## Develop

```bash
pnpm install
pnpm tauri dev
```

The Vite port is pinned to 1420 (`strictPort`). If you see it busy after a previous session, free it:

```bash
lsof -nP -iTCP:1420 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs -r kill
```

## Pre-commit checks

```bash
pnpm tsc --noEmit
pnpm tsc --noEmit -p tsconfig.node.json
```

## Local build

```bash
pnpm tauri build
```

Binaries land in `src-tauri/target/release/bundle/`.

## Cross-platform release

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds in parallel:

- macOS universal (`.dmg`, `.app`)
- Windows (`.msi`, `.exe`)
- Linux (`.AppImage`, `.deb`, `.rpm`)

…and publishes a draft GitHub release with the artefacts attached.

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Platform notes

- **macOS without a Developer ID** — first launch requires right-click → Open (Gatekeeper). Document this for users or sign the app.
- **Linux** — the `.deb` depends on `libwebkit2gtk-4.1-0` and `libssl3`. Recent Debian/Ubuntu packages provide both.
- **Windows** — WebView2 is shipped via `webviewInstallMode: embedBootstrapper`.

## Architecture

See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) (audio graph + components) and [`../DESIGN.md`](../DESIGN.md) (visual system) at the repo root.
