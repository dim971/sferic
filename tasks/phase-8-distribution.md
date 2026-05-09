# Phase 8 — Cross-platform build and CI

## Goal

Produce native binaries for macOS, Windows, and Linux and automate this build via GitHub Actions.

## Steps

1. **Configure the bundler** in `src-tauri/tauri.conf.json`:
   ```json
   {
     "bundle": {
       "active": true,
       "targets": "all",
       "category": "Music",
       "shortDescription": "Spatialise an audio file over time",
       "longDescription": "Cross-platform tool to add an 8D / HRTF spatialisation effect to an audio file via a 3D visual interface.",
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

2. **Generate the icons**: create a simple SVG icon (stylised 3D sphere + wave) and use:
   ```bash
   pnpm tauri icon ./assets/icon.png
   ```

3. **Local build** to validate on the dev machine:
   ```bash
   pnpm tauri build
   ```
   Verify the binaries appear in `src-tauri/target/release/bundle/`.

4. **GitHub Actions**: create `.github/workflows/release.yml`:
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
             releaseName: 'Sferic ${{ github.ref_name }}'
             releaseDraft: true
             prerelease: false
             args: ${{ matrix.args }}
   ```

5. **Lighter PR CI workflow** (`.github/workflows/ci.yml`):
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

6. **Document in `app/README.md`**:
   - How to install prerequisites per OS.
   - Commands: `pnpm install`, `pnpm tauri dev`, `pnpm tauri build`.
   - How to cut a release: tag `v0.1.0` and push.

7. **Test the binary** on at least one platform (ideally all three if possible):
   - The app opens.
   - Load an audio file, add keyframes, export.
   - No antivirus / Gatekeeper warnings blocking it.
   - **Note**: on macOS, without Developer ID signing, the user must right-click → Open the first time. Document that.

## Design

Before tagging `v0.1.0`, run a **final visual QA pass**: open `design/Screenshot 2026-05-09 at 08.53.47.png` side by side with the installed app and list the gaps. Any gap not documented in `DESIGN.md §9` (acknowledged stubs) must be fixed or tracked as an issue.

## Acceptance criterion

- All three bundles are produced locally (at least on the dev machine).
- The CI workflow passes on push.
- The Release workflow creates a draft release with the artifacts attached when tagging `v0.1.0`.
- The installed app behaves identically to `pnpm tauri dev`.

## Commit

```
feat(phase-8): cross-platform build and GitHub Actions CI
chore: tag v0.1.0
```

---

🎉 **At this stage, the application is complete and shippable.**

## Ideas for what's next (out of scope of the initial roadmap)

- Automatic **Doppler** effect based on source velocity.
- Multi-source (several tracks spatialised independently).
- **Ambisonics** import/export (B-format).
- "Trace" mode: draw a path in space instead of placing keyframes.
- Trajectory presets (horizontal rotation, descending helix, etc.).
- MIDI sync to drive positions from an external controller.
- **Video** export (animated visualisation + audio) for sharing on social networks.
