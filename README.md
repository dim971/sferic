# Spatialize — Kit de configuration

> Outil multiplateforme pour spatialiser un fichier audio dans le temps via une interface visuelle 3D, à la manière de l'effet « 8D Audio » du morceau *Billie Eilish – ilomilo (version Pentatonix)*.

Ce dépôt **n'est pas l'application** : c'est un **kit de configuration prêt à être délégué** à Claude Code et/ou Codex, qui se chargeront de générer le code à partir des spécifications, du roadmap et des tâches détaillées présentes ici.

---

## 1. Vision produit

L'utilisateur ouvre un fichier audio (WAV / MP3 / FLAC / OGG / M4A), voit la forme d'onde sur une timeline, et place sur une **sphère 3D interactive** des points de spatialisation (« keyframes ») associés à des moments précis du morceau. Entre deux keyframes, la position du son est interpolée. Le rendu peut être :

- **Écouté en temps réel** au casque (HRTF binaural)
- **Exporté** en fichier audio stéréo avec l'effet bakké (WAV/MP3)
- **Sauvegardé** comme projet réutilisable (JSON)

L'effet « 8D » est obtenu en automatisant la position spatiale d'une source sonore relative à un auditeur fixe via la `PannerNode` du Web Audio API en mode `HRTF` — c'est exactement le mécanisme utilisé par les éditeurs en ligne qui produisent ce genre de mixage.

## 2. Choix technologique : Tauri + React + TypeScript

### Pourquoi Tauri (et pas Electron, Flutter, Qt, ou natif) ?

| Critère | **Tauri 2** ✅ | Electron | Flutter | Qt |
|---|---|---|---|---|
| macOS / Windows / Linux | ✅ binaires natifs | ✅ | ✅ | ✅ |
| Taille d'install | ~5–15 MB | ~100–200 MB | ~30 MB | ~50 MB |
| Accès Web Audio API (HRTF natif) | ✅ via WebView | ✅ | ❌ pas d'équivalent | ❌ |
| Performance audio | ✅ Rust backend | ⚠️ Node.js | ⚠️ | ✅ |
| Écosystème UI moderne (React/Three.js) | ✅ | ✅ | partiel | partiel |
| Maturité audio offline / encodage | ✅ via crates Rust | ✅ via Node | ⚠️ | ✅ |

Le facteur décisif est le **Web Audio API**. La `PannerNode` en mode `HRTF` fournit nativement la spatialisation binaurale 3D — l'écrire à la main en C++/Rust prendrait des semaines. Tauri permet d'utiliser cette API gratuitement tout en gardant un binaire natif léger et un backend Rust performant pour le décodage/encodage.

### Stack complète

- **Shell desktop** : Tauri 2 (Rust)
- **Frontend** : React 18 + TypeScript + Vite
- **3D / scène spatiale** : Three.js via `@react-three/fiber` + `@react-three/drei`
- **Forme d'onde / timeline** : `wavesurfer.js` v7
- **Moteur audio temps réel** : Web Audio API (`AudioContext`, `PannerNode HRTF`, `AudioListener`, `ConvolverNode`)
- **Rendu offline** : `OfflineAudioContext` → encodage WAV (custom) ou MP3 (`@breezystack/lamejs`)
- **Décodage côté Rust** : `symphonia` (lecture multi-format)
- **Encodage côté Rust** : `hound` (WAV) — MP3 fait côté JS pour rester portable
- **Style** : Tailwind CSS 4
- **State management** : Zustand (léger, suffisant pour ce cas)
- **Persistence projet** : JSON via plugin `tauri-plugin-fs`

## 3. Comment utiliser ce kit

Le kit est conçu pour deux modes de délégation :

### Mode A — Tout à Claude Code (recommandé)

```bash
cd /chemin/où/tu/veux/le/projet
unzip spatialize-kit.zip
cd spatialize-kit
claude
```

Puis dans Claude Code :
> Lis `CLAUDE.md`, puis exécute le roadmap dans `ROADMAP.md` phase par phase. Pour chaque phase, suis les instructions du fichier correspondant dans `tasks/`. Crée le projet dans un sous-dossier `app/`.

### Mode B — Codex (CLI ou IDE)

```bash
cd spatialize-kit
codex
```

Codex lira automatiquement `AGENTS.md` (équivalent de `CLAUDE.md` pour OpenAI Codex) et suivra le même roadmap.

### Mode C — Hybride

Tu peux faire faire la **phase 0 à 2** par Claude (architecture solide, types stricts) et les **phases 3 à 8** par Codex en parallèle. Les frontières entre phases sont conçues pour être indépendantes.

## 4. Structure du kit

```
spatialize-kit/
├── README.md                  ← ce fichier
├── ARCHITECTURE.md            ← architecture technique détaillée
├── DESIGN.md                  ← système visuel (couleurs, typographie, layout)
├── ROADMAP.md                 ← plan d'exécution en 9 phases
├── CLAUDE.md                  ← instructions pour Claude Code
├── AGENTS.md                  ← instructions pour Codex / OpenAI
├── design/
│   └── Screen Shot ....png    ← image cible : source de vérité visuelle
├── tasks/
│   ├── phase-0-bootstrap.md
│   ├── phase-1-audio-loading.md
│   ├── phase-2-audio-engine.md
│   ├── phase-3-spatial-ui.md
│   ├── phase-4-timeline-keyframes.md
│   ├── phase-5-realtime-preview.md
│   ├── phase-6-offline-render.md
│   ├── phase-7-project-persistence.md
│   └── phase-8-distribution.md
├── templates/                 ← fichiers de config de référence
│   ├── package.json
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── .gitignore
└── prompts/
    ├── delegate-to-claude.md  ← prompt à coller dans Claude Code
    └── delegate-to-codex.md   ← prompt à coller dans Codex
```

## 5. Prérequis sur la machine de dev

À installer **avant** de lancer la délégation :

- **Node.js ≥ 20** ([nodejs.org](https://nodejs.org))
- **Rust ≥ 1.77** (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Tauri prerequisites** selon l'OS : voir [https://v2.tauri.app/start/prerequisites/](https://v2.tauri.app/start/prerequisites/)
  - macOS : Xcode Command Line Tools
  - Windows : Microsoft C++ Build Tools + WebView2
  - Linux : `webkit2gtk-4.1`, `libssl-dev`, `librsvg2-dev`, etc.
- **pnpm** (recommandé) : `npm install -g pnpm`

## 6. Démarrer

Lis `prompts/delegate-to-claude.md` ou `prompts/delegate-to-codex.md` selon ton agent préféré, et copie-colle son contenu dans la session.
