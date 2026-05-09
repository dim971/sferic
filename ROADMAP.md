# Roadmap — 9 execution phases

Each phase was **independently shippable** with a clear acceptance criterion. The original plan ran phase by phase and would not move on until each criterion was met. All nine phases are now delivered; this file is kept as historical reference.

| Phase | Goal | Detailed file | Estimated duration (agent) |
|---|---|---|---|
| 0 | Bootstrap Tauri + React + TS + Tailwind project | `tasks/phase-0-bootstrap.md` | 30 min |
| 1 | Load an audio file and display its waveform | `tasks/phase-1-audio-loading.md` | 1 h |
| 2 | Web Audio API engine + simple stereo playback | `tasks/phase-2-audio-engine.md` | 1 h |
| 3 | Three.js 3D scene with fixed listener + sphere + keyframe insertion | `tasks/phase-3-spatial-ui.md` | 2 h |
| 4 | Timeline with synchronised markers and keyframe editing | `tasks/phase-4-timeline-keyframes.md` | 1.5 h |
| 5 | Realtime playback with automated HRTF spatialization | `tasks/phase-5-realtime-preview.md` | 1.5 h |
| 6 | Offline export to WAV / MP3 stereo with the spatial effect baked in | `tasks/phase-6-offline-render.md` | 1.5 h |
| 7 | Save / load `.sferic.json` projects | `tasks/phase-7-project-persistence.md` | 1 h |
| 8 | Cross-platform build and GitHub Actions CI | `tasks/phase-8-distribution.md` | 1 h |

**Estimated total**: ~11 hours of autonomous agent work with human validation between phases.

## Global rules (applied throughout)

1. **Test at the end of each phase** — `pnpm tauri dev` must start without errors.
2. **Atomic commits per phase** — one `feat(phase-N): …` commit when the phase wrapped up.
3. **TypeScript strict** — `"strict": true`, no `any` unless justified in a comment.
4. **No library outside the ARCHITECTURE.md list without asking**.
5. **Preserve the component decomposition** spelled out in the architecture.
6. **Tauri 2 only** — never mix v1 and v2.
7. **Always use pnpm** (not npm/yarn) so the lockfile stays consistent.

## User-side preparation (before phase 0)

Check on the target machine:

```bash
node -v        # ≥ 20
rustc --version # ≥ 1.77
pnpm -v        # any recent version
```

And install Tauri 2 system dependencies per OS:
[https://v2.tauri.app/start/prerequisites/](https://v2.tauri.app/start/prerequisites/)

## Beyond v0.1

Now that the original phases are landed, future work is request-driven (bug fixes, polish, new features). Some directions on the table:

- Multi-source mixing (more than one spatialized track at once)
- Ambisonic export (B-format / Atmos sidecar)
- MIDI controller mapping for keyframe parameters
- Web build (audio-only, no native rendering)
