# Phase 4 — Timeline with markers and inspector

## Goal

Tie the timeline (waveform) to the keyframes:
- Display each keyframe as a vertical marker on the waveform.
- Click on the waveform → seek + (in "add" mode) → add a keyframe.
- Side inspector to edit the selected keyframe's properties.

## Steps

1. **Extend `Waveform.tsx`**:
   - Sync the WaveSurfer cursor with the store's `playback.currentTime`.
   - On `ws.on('seek', ...)`, call the store's `seek()`.
   - Disable WaveSurfer's auto-managed seek if needed to keep a single source of truth.

2. **Add WaveSurfer's Markers / Regions plugin** for keyframes:
   ```bash
   pnpm add wavesurfer.js
   ```
   Use `RegionsPlugin` or build a simple overlay:
   - Absolute layer `position: relative` on the waveform container.
   - For each keyframe, a vertical line at `left: (kf.time / duration) * 100%`.
   - Line `onClick` → `selectKeyframe(kf.id)`.

3. **Create `src/components/inspector/Inspector.tsx`** strictly following `DESIGN.md §5`. The panel (320px right, `bg-[--bg-panel]`) has two modes:

   - **No keyframe selected** → show **project settings** in a single `PROJECT` section:
     - Toggle `panningModel` (HRTF / equalpower).
     - Slider `refDistance` (0..10), `rolloffFactor` (0..2).
     - Toggle `reverb.enabled` + slider `reverb.wet` (0..1).
     - Toggle `snapToSphere` (default true).

   - **Keyframe selected** → show the header + 4 sections (`POSITION`, `MOTION`, `GAIN & FADES`, `DOPP`). See `DESIGN.md §5.1–5.5` for the precise layout. Recap:

     **Header**:
     - Tab `INSPECTOR` (section label).
     - Row: `--accent` 10px diamond icon, `Keyframe NN`, `< 1 of N >` paginator on the right (cyclic across keyframes sorted by time).
     - Row: mono timecode `00:11.150`.

     **`POSITION` section**:
     - 3 cartesian inputs (X, Y, Z) in mono, `--bg-input` background. Real-time update on change.
     - 3 spherical readouts (Az, El, R) computed from (X,Y,Z) — read-only in v1.

     **`MOTION` section**:
     - **Curve picker**: 4 chips `Linear` / `Eaze` / `Smooth` / `Step` (see `DESIGN §5.3`). Active chip = `bg-[--accent-soft] border-[--accent] text-[--accent]`.
     - `Duration` input (s, default = gap to previous keyframe).
     - `Tension` input (0..1, only effective if curve === 'smooth').

     **`GAIN & FADES` section**:
     - `Vol` input dB (-24..+6).
     - `HPF` input Hz (UI stub v1 — mark with `*`).
     - `LPF` input Hz (UI stub v1 — mark with `*`).
     - `Snapper` toggle (the keyframe's `snap`).

     **`DOPP` section**:
     - `Speed` (m/s, read-only, computed from adjacent keyframes).
     - `Doppler` toggle (v1 stub).
     - `Velocity` toggle (v1 stub).
     - `Intensity` slider 0..1 (v1 stub).

   - **Delete button**: `Trash2` icon red `--vu-red`, at the bottom of the panel, confirms via `dialog.ask`.

   Mark stub controls with a discreet `*` asterisk in `--text-dim` next to the label, or a tooltip "v1: read-only" (see `DESIGN §9`).

4. **Waveform behaviour**:
   - **Single click** on the waveform → seek.
   - **Shift + click** → adds a keyframe at that time, at the source's current 3D position (or `(0,0,-1)` if no keyframe before).
   - Show these shortcuts in a discreet legend below the timeline.

5. **Style the keyframe markers** on the waveform (see `DESIGN §6.2`):
   - Vertical 2px line full height, `--accent` colour opacity 0.5.
   - If selected: opacity 1, small 6px orange diamond at the top, `X` button (icon `lucide-react/X`) on hover at the top → `removeKeyframe(id)`.

6. **Time ruler** below the waveform (see `DESIGN §6.4`): 16px strip with 0:00, 0:30, 1:00, etc. graduations in mono `text-[10px] --text-dim`. The tick matching a selected keyframe goes `--accent`.

7. **Compose the final `<Timeline />`**: the bottom row (180px) holds a `grid-cols-[auto_1fr_auto] gap-3 px-3 py-2` grid (see `DESIGN §6`):
   - Left block: `<TransportBar />` (created in phase 2) + 5-readout mono grid (x, y, z, az, el of the current source).
   - Centre block: `<Waveform />` + its markers + ruler.
   - Right block: `± zoom` buttons (`Plus`/`Minus` icons), compact selection readout.

8. **Add keyboard shortcuts** in a `useKeyboardShortcuts()` hook:
   - `Space` → play/pause
   - `Delete` → remove the selected keyframe
   - `Esc` → deselect
   - `Cmd/Ctrl+S` → save (for phase 7, prepare the hook now)

## Design

This is the visually densest phase. Compare **section by section** with the screenshot and `DESIGN.md §5–6`. Common pitfalls:
- Curve chips should be inline, compact, and the selected one clearly pops (not just bold text).
- Spherical readouts (Az/El/R) are non-editable in `--text-secondary` — confusing them with inputs would break the analogy with the screenshot.
- Stubs (HPF/LPF/Doppler/Velocity) must be **present** in the UI, not hidden — that's what makes the render faithful to the target. Marking them as stubs (asterisk + tooltip) is enough.
- The timeline has **three blocks** aligned horizontally (transport+readouts | waveform+ruler | zoom). No line wrapping, it must fit in 180px tall.

## Acceptance criterion

- Keyframes added in phase 3 appear as orange lines on the waveform.
- Clicking a line selects the keyframe (visible in both 3D scenes + inspector).
- The inspector shows the 4 sections (POSITION, MOTION, GAIN & FADES, DOPP) with header + paginator. Editing functional controls (X/Y/Z, Curve, Duration, Tension, Vol, Snapper) propagates in real time.
- Stub controls (HPF/LPF/Doppler/Velocity) are visible, their values are stored on the keyframe, but they are not wired to the audio in v1.
- Shift+click on the waveform adds a keyframe at the right time.
- Space starts/pauses playback.
- Compare the inspector layout with the screenshot: density, alignment, label casing (`POSITION` uppercase), tabular nums on every readout.

## Commit

```
feat(phase-4): timeline with keyframe markers and inspector
```
