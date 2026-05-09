# UPDATE — design v1.4 addendum

This addendum extended the original kit to cover the features of the final design (reference: Sferic 1.4.2 mockup). Historically it shipped as a zip to be unpacked **into the same folder as the main kit**: files added next to existing ones without physically replacing anything, but **changing the roadmap execution order**.

## How the change was integrated

1. Unpacked `spatialize-kit-addendum.zip` at the kit root, producing:
   ```
   spatialize-kit/
   ├── UPDATE.md                                          ← this file
   ├── tasks/
   │   ├── phase-3b-dual-orthographic-views.md            ← REPLACES phase 3
   │   ├── phase-9-extended-keyframe-properties.md        ← NEW
   │   └── phase-10-audio-analysis-monitoring.md          ← NEW
   └── (existing files unchanged)
   ```
2. Before launching Claude Code / Codex, **edit `ROADMAP.md`** to use the new sequence (next section).
3. The delegation prompt remains valid, but prepend:
   > **Important**: read `UPDATE.md` first. It alters the original roadmap. Follow the execution order given in `UPDATE.md`, not the one in `ROADMAP.md`.

## New roadmap (applied)

| # | Phase | Status | File |
|---|---|---|---|
| 0 | Bootstrap Tauri + React + TS + Tailwind | unchanged | `tasks/phase-0-bootstrap.md` |
| 1 | Audio loading + waveform | unchanged | `tasks/phase-1-audio-loading.md` |
| 2 | Web Audio API engine | unchanged | `tasks/phase-2-audio-engine.md` |
| **3b** | **TOP + SIDE orthographic views** | **NEW — replaces 3** | `tasks/phase-3b-dual-orthographic-views.md` |
| 4 | Timeline with markers and inspector | unchanged | `tasks/phase-4-timeline-keyframes.md` |
| 5 | Realtime HRTF spatialization | unchanged | `tasks/phase-5-realtime-preview.md` |
| **9** | **Extended keyframe properties** (gain, filters, send, doppler, cubic curve) | **NEW** | `tasks/phase-9-extended-keyframe-properties.md` |
| **10** | **Audio analysis + monitoring** (BPM, key, CPU, VU meters) | **NEW** | `tasks/phase-10-audio-analysis-monitoring.md` |
| 6 | Offline export WAV/MP3 | **extended** (see below) | `tasks/phase-6-offline-render.md` |
| 7 | Save / load projects | **extended** (v1 → v2 migration) | `tasks/phase-7-project-persistence.md` |
| 8 | Cross-platform build and CI | unchanged | `tasks/phase-8-distribution.md` |

**Order rationale**: phases 9 and 10 must happen **before** phase 6 (export). Otherwise the offline render wouldn't know how to apply per-keyframe filters, gains, and sends — we'd have to come back and refactor everything. Same for phase 7 (persistence): it must handle the enriched project format.

## Adjustments to existing phases

### Phase 0 — Bootstrap

Add these dependencies during bootstrap:
```bash
pnpm add web-audio-beat-detector
# Optional for key detection — can be deferred to phase 10
# pnpm add essentia.js
```

### Phase 4 — Timeline and inspector

The **inspector** in this phase is no longer minimal. It must be structured up front into collapsible sections:
- `POSITION` (Cartesian and polar coordinates with a toggle)
- `MOTION` (placeholder for phase 9: hold/linear/ease-out/cubic curves + tension)
- `GAIN & FILTER` (empty sections at this stage, filled in phase 9)
- `SEND` (same)

Add a keyframe header containing:
- Stable number (`k01`, `k02`, …) computed dynamically from the time index
- Editable label
- Navigation `‹ N of M ›`
- Duplicate / delete buttons

### Phase 6 — Offline export (extension)

When the agent picks this phase up:
1. The `OfflineAudioContext` must reproduce the **full** signal graph from phase 9 (panner + filters + gain + reverb send), not just the panner.
2. The `renderProject` function must schedule every automation: position, gain, lpf, hpf, send.
3. Add a **Render** dialog (no longer a plain Export) with:
   - Format: WAV / MP3 / FLAC (FLAC = bonus, can be deferred)
   - Bit depth: 16 / 24 / 32-bit float (WAV)
   - Bitrate: 192 / 256 / 320 kbps (MP3)
   - Time range: full / loop region / selection
   - Dithering: on / off (for 16-bit)
   - Progress bar
   - "Cancel" button

### Phase 7 — Persistence (extension)

The project format moves to `version: 2`.

Implement a `migrateV1ToV2(p1: ProjectV1): ProjectV2` function that:
- Preserves position, time, curve (maps `easeIn` → `ease-in`, `step` → `hold`)
- Initialises new keyframe properties: `gain: 0, lpf: null, hpf: null, doppler: true, airAbsorption: 0.18, reverbSend: null, tension: 0.5`
- Initialises `audioMeta: { bpm: null, key: null }` (filled on next load)

## Topbar / menu adjustments

The final design shows a **real native menu bar** (`File / Edit / Project / Render / View / Help`). Implement via the `tauri::menu` API on the Rust side:

```rust
// in src-tauri/src/main.rs
use tauri::menu::{Menu, MenuItem, Submenu};

let file_menu = Submenu::new("File", Menu::new()
    .add_item(MenuItem::new("Open project…", "open_project", true, Some("CmdOrCtrl+O")))
    .add_item(MenuItem::new("Save", "save", true, Some("CmdOrCtrl+S")))
    .add_item(MenuItem::new("Save as…", "save_as", true, Some("CmdOrCtrl+Shift+S")))
    .add_separator()
    .add_item(MenuItem::new("Import audio…", "import_audio", true, Some("CmdOrCtrl+I")))
    .add_separator()
    .add_item(MenuItem::new("Render…", "render", true, Some("CmdOrCtrl+R"))));
// likewise for Edit / Project / Render / View / Help
```

Emit a Tauri event (`emit_all("menu", id)`) on click, listened to from React via `listen('menu', ...)`. This task is **small** (≈ 30 min) and can land at the end of phase 4 or in parallel.

## Additional global verifications

By the end of phase 10, the topbar must show:
- Project name and source audio file ✅
- Sample rate + bit depth ✅ (from `AudioBuffer.sampleRate` and file metadata via Rust)
- UNSAVED indicator when dirty ✅
- CPU % (via tauri-plugin-sysinfo or an `audioContext` callback approximation) ✅
- Buffer size (`audioContext.outputLatency * sampleRate`, rounded) ✅
- L/R VU meters ✅

And at the bottom (transport bar):
- Current position in `m:ss.mmm` ✅
- BAR / Beat / Sixteenth derived from BPM ✅
- Detected BPM + key ✅
- Monitoring mode (BINAURAL / STEREO BYPASS) ✅
