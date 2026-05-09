# AGENTS.md — Instructions for Codex

This file follows the `AGENTS.md` convention recognised by Codex and other OpenAI agents.

## Mission

Implement and maintain **Sferic**: a cross-platform desktop tool (macOS, Windows, Linux) for spatializing an audio file in time through a visual 3D interface.

## Sources of truth (read first)

| File | Content |
|---|---|
| `README.md` | Vision, tech stack, rationale |
| `ARCHITECTURE.md` | Data model, audio graph, React components, IPC |
| `DESIGN.md` + `design/*.png` | Visual system and reference image — source of truth for all rendering |
| `ROADMAP.md` | Original 9-phase plan (now mostly delivered) |
| `tasks/phase-N-*.md` | Detailed spec per phase (historical reference) |

## Required tech stack

- **Tauri 2** (Rust shell)
- **React 19** + **TypeScript strict** + **Vite**
- **Three.js** via `@react-three/fiber` + `@react-three/drei`
- **wavesurfer.js v7** for the waveform timeline
- **Native Web Audio API** for the audio engine (PannerNode HRTF)
- **Zustand** for state
- **Tailwind CSS v4** — note the v4 syntax (`bg-[var(--token)]`, not `bg-[--token]`)
- **pnpm** as the package manager
- Rust crates: `symphonia` (decoding), `hound` (WAV encoding)

Do not substitute these choices without asking.

## Working mode

The original plan was phase-by-phase. Phases are largely complete; new work arrives as targeted bug fixes and features. For each request:

1. Identify the affected files via `ARCHITECTURE.md` or a quick repo scan.
2. Implement the change surgically.
3. Verify acceptance manually.
4. Run `pnpm tsc --noEmit` and `pnpm tauri dev` (or `pnpm build` for a faster check).
5. Commit using Conventional Commits (`feat(scope): …`, `fix(scope): …`).

## Conventions

- Functional React components, hooks, no classes (except the `AudioEngine` singleton).
- Absolute imports through the `@/` alias → `app/src/`.
- No TypeScript `any`.
- One file per component.
- Tailwind utility-first, v4 syntax.
- Tests: Vitest for utilities (waveform, encoders, 3D math).

## Tauri security

- Minimal capability/allowlist: only `dialog:open`, `dialog:save`, `fs:read`, `fs:write`, scoped to the user's home, common system audio dirs, and external volumes (see `app/src-tauri/capabilities/default.json`).
- No `shell:execute`, no network APIs.

## Expected first response when starting a new session

1. Confirm you have read the five sources of truth (including `DESIGN.md` and the `design/` reference image).
2. Acknowledge the user's request and begin work.
