# DESIGN — Sferic visual system

> **Visual source of truth**: `design/Screenshot 2026-05-09 at 08.53.47.png`
> This image defines the target rendering. Any divergence must be justified and discussed.

The application borrows the codes of a pro DAW: **very dark background, dominant orange accent, compact typography, dense numeric readouts**. Every screen lives within that same grammar.

---

## 1. Design tokens

To declare in `app/src/index.css` via Tailwind 4's `@theme` layer (`@theme { --color-...: ...; }`) or as plain CSS variables.

### 1.1 Colours

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#07080A` | Global background (area around the panels) |
| `--bg-panel` | `#0E0F13` | Panel background (3D scenes, inspector, timeline) |
| `--bg-panel-elev` | `#15171C` | Inner inspector sections, button hover |
| `--bg-input` | `#1A1C22` | Numeric fields, idle sliders |
| `--border-subtle` | `#1F222A` | Panel separators |
| `--border-strong` | `#2A2E38` | Field and inactive button borders |
| `--text-primary` | `#E8E8EA` | Values, titles |
| `--text-secondary` | `#9CA0AB` | Labels, top menu items |
| `--text-dim` | `#5A5F6B` | Disabled text, units, hints |
| `--accent` | `#F87328` | Primary accent colour (Sferic orange) |
| `--accent-hot` | `#FF8A3D` | Accent hover/active |
| `--accent-soft` | `#3A1E12` | Orange chip backgrounds (UNSAVED, selection) |
| `--listener` | `#4F8EF7` | The blue listener dot (and the only blue used) |
| `--vu-green` | `#22A858` | VU meter LEDs (safe zone) |
| `--vu-yellow` | `#E0B341` | VU meter LEDs (warn zone) |
| `--vu-red` | `#E0533C` | VU meter LEDs (clip zone) |
| `--waveform` | `#F87328` | Waveform (= accent) |
| `--waveform-bg` | `#1A0E08` | Waveform container background |

### 1.2 Typography

- **Primary family**: `Inter`, fallback `system-ui, -apple-system, sans-serif`. Loaded via `@fontsource/inter` or Google Fonts (chosen at phase 3).
- **Numeric family**: `JetBrains Mono`, fallback `ui-monospace, monospace`. Used for **all numeric readouts** (coordinates, time, dB, Hz). Digits must be tabular (`font-variant-numeric: tabular-nums;`).
- **Sizes**:
  - `text-[10px]` — section labels (`POSITION`, `MOTION`, `GAIN & FADES`, `DOPP`), with `tracking-widest uppercase text-[--text-dim]`.
  - `text-[11px]` — field labels (X, Y, Z, Az, El, R, Vol, HPF…), `text-[--text-secondary]`.
  - `text-[12px]` — numeric values, top menu items.
  - `text-[13px]` — keyframe titles (`Keyframe 05`).
  - `text-[14px]` — primary buttons (Save, Open, Render).
  - `text-[16px]` — `Sferic` logo.

### 1.3 Spacing / radii / shadows

- Radii: `rounded-md` (4px) everywhere. No pronounced rounding.
- Internal spacing: `px-2 py-1.5` for fields, `p-3` for inspector sections, `gap-2` between fields on the same line.
- Shadows: none. Contrast comes purely from backgrounds and `--border-*`.

---

## 2. Global layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Topbar (h ≈ 44px)                                                       │
├──────────────────────────────────────┬───────────────────────────────────┤
│  SceneTop      │  ScenePerspective   │                                   │
│  (1fr)         │  (1fr)              │   Inspector (320px)               │
│                │                     │                                   │
├──────────────────────────────────────┴───────────────────────────────────┤
│  Timeline (transport + waveform + ruler)  (h ≈ 180px, resize 140-260)    │
└──────────────────────────────────────────────────────────────────────────┘
```

Tailwind: `grid grid-rows-[44px_1fr_180px] grid-cols-[1fr_320px]`. Row 2 contains the `<DualScene />` (which subdivides 50/50 internally) on the left and the `<Inspector />` on the right. Row 3 (Timeline) spans both columns.

---

## 3. Topbar

A single line, vertically centred, background `--bg-base`, separated from the main area by `border-b border-[--border-subtle]`.

**Left to right**:

1. **Logo**: solid orange 8px chip + text `Sferic` in `text-[16px]` white, `font-medium`.
2. **Menus**: `File / Edit / Project / Render / View / Help` in `text-[--text-secondary] text-[12px]`, gap `gap-3`. Hover → `text-[--text-primary]`. Clicks open a native menu (phase 7+).
3. **Source file metadata** (centre): `<source-name>` in `--accent`, then sample rate (`44.1k`), then loaded audio file name in `text-[--text-secondary]`.
4. **Save indicator**: `UNSAVED` chip (background `--accent-soft`, text `--accent`, `text-[10px] tracking-widest uppercase`, `px-2 py-0.5 rounded-md`). Visible only when `isDirty === true`.
5. **Save / Open**: orange outline buttons (`border border-[--accent] text-[--accent] hover:bg-[--accent-soft]`, `text-[14px] px-3 py-1 rounded-md`).
6. **VU meters**: two vertical bars (L/R), 14 segments each. Colours: 10 green segments, 3 yellow, 1 red, lit/unlit per level. Height ≈ 28px. Animation via requestAnimationFrame from the audio engine's `AnalyserNode` (phase 5).
7. **Render**: filled orange CTA button (`bg-[--accent] hover:bg-[--accent-hot] text-white font-medium text-[14px] px-4 py-1.5 rounded-md`). Opens the export modal (phase 6).

---

## 4. 3D scenes — `DualScene`

**Two R3F canvases side by side**, separated by a 1px `--border-subtle` line.

| Panel | Camera | Purpose |
|---|---|---|
| `SceneTop` | `OrthographicCamera` from above, looking at -Y | Top-down view (precise placement in the horizontal plane) |
| `ScenePerspective` | Free `PerspectiveCamera`, `OrbitControls` enabled | 3D view with rotation, sense of space |

Both scenes share **the same state** (same keyframes, same playhead). Selecting a keyframe in one selects it in the other.

### 4.1 Common visual content

- **Wireframe sphere** of radius 1, `meshBasicMaterial({ color: '#F87328', wireframe: true, transparent: true, opacity: 0.18 })`. Moderate subdivision (segments=20,16) — it should read as a grid, not a solid.
- **Listener**: small `--listener` solid sphere of radius 0.04 at the origin. No directional cone (the listener is fixed).
- **Trajectory**: orange line (`--accent`, opacity 0.6, thickness 2) connecting interpolated positions from the first to the last keyframe (sampled at ~64 segments). Visible only when ≥ 2 keyframes.
- **Keyframe markers**: solid `--accent` sphere of radius 0.05, 1px `--accent-hot` outline. Floating numbering (HTML overlay via drei's `<Html>`) in `text-[10px]` white.
- **Selected keyframe**: radius 0.08, halo (circular sprite 0.18 transparent `--accent`), extended label (`Keyframe NN` + time).
- **Current source** (interpolated position at the playhead time): solid `--accent` sphere of radius 0.06 with a stronger halo, distinct from markers by its size and halo.

### 4.2 HTML overlays per scene

- Top-left corner: view label (`TOP` / `PERSPECTIVE`) in `text-[10px] tracking-widest uppercase --text-dim`.
- Top-right corner: current timecode in mono (`text-[--text-secondary] text-[12px]`).
- Bottom corners: axis markers (`+1.0` / `-1.0`) on `SceneTop`, angle readouts (azimuth, elevation) on `ScenePerspective`.

### 4.3 Interactions

- **Click in empty space** on `ScenePerspective` (unit-sphere radius) → `addKeyframe(projectedPosition, currentTime)`. The projection respects `settings.snapToSphere` (default true → position is normalised to r=1).
- **Click on a marker** → `selectKeyframe(id)`.
- **Drag** of a selected marker → `updateKeyframe(id, { position })` in real time.
- `OrbitControls` active on `ScenePerspective` only (the Top view stays fixed).

---

## 5. Inspector (right panel, 320px)

Container: `bg-[--bg-panel] border-l border-[--border-subtle] overflow-y-auto p-3`. When no keyframe is selected, the **project settings** are shown (panningModel, distanceModel, refDistance, rolloffFactor, reverb).

When a keyframe is selected:

### 5.1 Header

```
INSPECTOR                                            (section label)
─────
[icon] Keyframe 05                          [< 1 of 7 >]
00:11.150
```

- Keyframe icon: small 10px orange diamond.
- Pagination: left/right arrows cycling between keyframes sorted by time.

### 5.2 `POSITION` section

Two sub-blocks stacked in a column:

**Cartesian** (3 lines):
```
X    [-0.420]
Y    [-0.180]
Z    [ 0.00 ]
```
Each field: numeric mono input, background `--bg-input`, `text-[12px]`, orange focus. Horizontal drag on the label to scrub (classic DAW gesture, optional in v1).

**Spherical (read-only in v1)**:
```
Az   +45.0°
El   +27.0°
R    0.92
```
Computed from (X,Y,Z). In `--text-secondary text-[12px]`. Used as a readout, not an input in v1.

### 5.3 `MOTION` section

**Curve picker**: 4 horizontal chips side by side, `flex gap-1`, label on top (`CURVE`). Values: `Linear`, `Eaze` (= easeInOut), `Smooth` (= softened setTargetAtTime), `Step`. Active chip = background `--accent-soft`, border `--accent`, text `--accent`. Inactive = border `--border-strong`, text `--text-secondary`.

> **v1 note**: `Eaze` maps to internal `easeInOut`, `Smooth` maps to `setTargetAtTime` with an adapted tau. Keep these 4 names exact in the UI even if the audio engine internally handles only 2-3 distinct ones.

**Duration**: numeric field + slider (`+0.000s`). Sets the transition duration to this keyframe from the previous one (`0` = instant, default = the time gap with the previous keyframe).

**Tension**: numeric field 0..1 (`0.42`). Acts only on `Smooth` curves (modifies the `setTargetAtTime` tau).

### 5.4 `GAIN & FADES` section

```
Vol    [-2.5]  dB
HPF    [10.0]  Hz
LPF    [40]    Hz       (slider/numeric)
Snapper [●○]  (toggle)
```

- `Vol`: per-keyframe gain in dB, range `-24..+6`. Phase 5 hooks it up to an automated `GainNode`.
- `HPF` / `LPF`: cutoff frequencies. Phase 5 (or polish phase) wires them into two `BiquadFilterNode`s.
- `Snapper`: per-keyframe "snap-to-sphere" toggle (force `r=1` even if the user dropped the point elsewhere). Stores a `snap` flag in the keyframe.

> **Strict v1 note**: `HPF`, `LPF` and `Snapper` may stay as **UI stubs** (values stored in the keyframe but ignored by the audio engine in v1). Marked as such in the inspector via an asterisk icon or a "v1: read-only" tooltip. `Vol` (`gainDb`) must be functional from phase 5.

### 5.5 `DOPP` (Doppler) section

```
Speed     [32]  Vs
Doppler   [○]
Velocity  [●]
   0.75   (intensity)
```

- `Speed`: simulated speed in m/s (read-only, computed from adjacent keyframes).
- `Doppler` toggle: enables frequency shift based on radial velocity (strict v1: stub).
- `Velocity` toggle: enables gain modulation based on tangential velocity (strict v1: stub).
- Value 0..1: global doppler/velocity intensity.

> **Strict v1 note**: the entire `DOPP` section may stay as a UI stub. Store the values in the keyframe, do not wire them to the audio engine in v1. Later phase (post current roadmap).

### 5.6 Toggle styling

Generic toggle: `12px` chip, background `--bg-input` when off, `--accent` when on, 120ms transition. Label on the left in `--text-secondary`.

---

## 6. Timeline (bottom row)

Full-width container (spans both columns), `bg-[--bg-panel] border-t border-[--border-subtle]`.

Internal grid: `grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2`.

### 6.1 Left block — transport + readouts

```
[⏵] [⏸] [⏹]    1:23
+1.0  +1.0  +0  +0   0
```
- 3 buttons (play/pause/stop), filled orange icons 16px on transparent background. Active state = `--accent-soft` background.
- Time display in mono, `text-[14px]`, `--text-primary`.
- A 5-column grid of mono readouts (`text-[10px] --text-dim`): x, y, z, az, el of the current source.

### 6.2 Centre block — waveform

- `wavesurfer.js` v7:
  - `waveColor: '#F87328'`
  - `progressColor: '#FF8A3D'`
  - `cursorColor: '#FFFFFF'`
  - `cursorWidth: 1`
  - `barWidth: 1`, `barGap: 1`, `barRadius: 0`
  - `height: 96`
  - `backgroundColor: '#1A0E08'` (assigned via CSS on the container)
- **Keyframe markers**: vertical 2px line spanning the waveform height at `(kf.time / duration) * 100%`, colour `--accent` opacity 0.5. Selected → opacity 1, small 6px orange diamond on top, X button on hover. Click → `selectKeyframe`. Shift+click on the waveform → `addKeyframe(interpolatedPosition, time)`.

### 6.3 Right block — zoom controls

- `±` buttons for timeline zoom.
- Compact readout of the current selection (`+87/+100`) in mono `--text-dim`.

### 6.4 Time ruler (under the waveform)

A 16px strip, `bg-transparent border-t border-[--border-subtle]`. Tick marks at 0:00, 0:30, 1:00, etc. in mono `text-[10px] --text-dim`. The tick matching a selected keyframe switches to `--accent`.

---

## 7. Iconography

- **Single source**: `lucide-react` (already lightweight, MIT). Added in phase 1: `pnpm add lucide-react`.
- All icons: 16px, stroke 1.5px, colour inherited from `currentColor`. No fill except transport (filled play/pause/stop).
- Expected icons: `Play`, `Pause`, `Square` (stop), `FolderOpen`, `Save`, `Download` (export/render), `Plus`, `Trash2`, `ChevronLeft`, `ChevronRight`, `Diamond` (keyframe).

---

## 8. Interactive states

| State | Effect |
|---|---|
| Hover outline button | `bg-[--accent-soft]` |
| Hover filled button | `bg-[--accent-hot]` |
| Focus input | `--accent` 1px border, no system outline |
| Drag in progress on a scrubber | `cursor-ew-resize`, halo `--accent` opacity 0.3 |
| Disabled | opacity 0.4, `cursor-not-allowed`, no hover |
| Selected keyframe | orange halo + `--accent` border everywhere (3D, timeline, inspector) |

---

## 9. v1 stubs vs functional

To stay aligned with the existing ROADMAP **without blocking the 1:1 visual**, some inspector fields store their value in the data model but **don't act yet** on the audio engine in v1. Recap:

| Control | v1 | Phase that wires it |
|---|---|---|
| Position X/Y/Z | ✅ functional | 3 |
| Az/El/R readout | ✅ functional (computed) | 4 |
| Curve (Linear/Eaze/Smooth/Step) | ✅ functional | 5 |
| Duration / Tension | ✅ functional | 5 |
| Vol (`gainDb`) | ✅ functional | 5 |
| Snapper (`snap`) | ✅ functional (placement) | 3 |
| HPF / LPF | ⚠️ UI stub | post-v1 (to propose after phase 8) |
| Doppler / Velocity / Speed | ⚠️ UI stub | post-v1 |
| VU meters | ✅ functional | 5 |

Mark stubs with a small `· stub` mention in `--text-dim` next to the label, or an asterisk `*` next to the value, for transparency to users.

---

## 10. Visual reference

The image `design/Screenshot 2026-05-09 at 08.53.47.png` is the **treasure map**: at every phase that touches the UI, the agent opens this image and compares the local rendering pixel by pixel (proportions, colours, hierarchy). Any visible deviation must be corrected before the phase commit, or explicitly noted in the phase recap.

Priority order when arbitration is needed:
1. **The screenshot** (when visually striking).
2. **DESIGN.md** (this file — for details not visible in the screenshot).
3. `ARCHITECTURE.md` (for technical constraints).
4. The agent's personal taste (never).
