# Phase 3b — TOP + SIDE orthographic views

> **This phase REPLACES the original phase 3** (`tasks/phase-3-spatial-ui.md`). Don't do phase 3, do this one instead.

## Goal

Build **two 2D orthographic views side by side** (TOP: X/Z plane seen from above; SIDE: Z/Y plane seen from the side) instead of a Three.js 3D scene. Each view shows:

- Concentric reference circles (radii 0.25, 0.5, 0.75, 1.0)
- Labelled axes (`-X`, `+X`, `-Z`, `+Z`, `-Y`, `+Y`)
- The listener at the centre (blue dot with a small directional cone)
- All keyframes (orange circles numbered `1`, `2`, … by temporal order)
- The selected keyframe highlighted (dashed ring around it)
- A dashed path connecting the keyframes in temporal order
- The current interpolated position during playback (orange cursor distinct from the keyframes)
- Info bar at the bottom: `cur x +0.62  z +0.30  az +62°`
- Floating controls bottom-right: zoom (auto-fit), recenter, lock view

The user can **click in empty space** to add a keyframe at that projected position (the non-visible coordinate keeps its current interpolated value), **click a keyframe** to select it, and **drag** a keyframe to move its coordinates in the visible plane.

## Why 2D and not 3D?

A Three.js 3D scene with OrbitControls forces the user to manipulate the camera before being able to edit a point — useless friction. Two fixed orthos are faster to use, more precise, and more readable on screen (no perspective issues that make distances misleading). Every professional spatial audio editor (Dolby Atmos Renderer, dearVR, etc.) uses this paradigm.

## Steps

### 1. No Three.js in this phase

Don't install `three`, `@react-three/fiber`, `@react-three/drei`. Everything is done in **SVG** in React, which is performant enough for a dozen keyframes and lets you style with Tailwind directly.

### 2. Define types and store (extensions)

Extend `src/types/project.ts` with:

```ts
export type Projection = 'top' | 'side';

export interface ViewState {
  zoom: number;          // 1.0 = unit sphere fits in the view
  locked: boolean;       // if true, ignores clicks and drags
}
```

Extend the store with:

```ts
viewStates: { top: ViewState; side: ViewState };
snapAngleDeg: number;       // 0 = no snap, otherwise 5/10/15/30/45/90
setViewState: (which: Projection, partial: Partial<ViewState>) => void;
setSnapAngle: (deg: number) => void;
addKeyframeAtProjection: (proj: Projection, u: number, v: number) => void;
moveKeyframe: (id: string, proj: Projection, u: number, v: number) => void;
```

Where `(u, v)` are the normalised coordinates in the view's plane: for `top`, `u = x`, `v = z`; for `side`, `u = z`, `v = y`.

### 3. `OrthographicView` component

Create `src/components/scene/OrthographicView.tsx`. Signature:

```tsx
interface OrthographicViewProps {
  projection: Projection;
  className?: string;
}
```

Behaviour:

- Renders an `<svg viewBox="-1.2 -1.2 2.4 2.4" preserveAspectRatio="xMidYMid meet">` (origin at the centre, ±1.2 amplitude to leave a bit of air around the unit sphere).
- The viewBox is multiplied by `1 / zoom` to handle zoom.
- **Coordinate conversion**: a world point `(x, y, z)` projects to SVG as:
  - `top`: `(svgX, svgY) = (x, -z)` → -Z at the top, +Z at the bottom, matching the screenshot
  - `side`: `(svgX, svgY) = (z, -y)` → -Y at the top, +Y at the bottom (Y inverted for visual consistency with "head up" orientation)
- Background drawing:
  - 4 concentric circles (radii 0.25, 0.5, 0.75, 1.0) stroked `#2a2a2a`, dasharray on the 3 inner ones, solid for radius 1.0
  - Axis cross (lines `−1.2 → 1.2` horizontal and vertical) in `#1f1f1f`
  - Axis labels as SVG text, size `0.06`, fill `#666`; positions on the viewBox edges
- Draws the **path**:
  - Sorts keyframes by `time`
  - Builds a `<path d="M x1 y1 L x2 y2 …">` with `stroke="#ff7a3c66"` (transparent orange) and `stroke-dasharray="0.02 0.02"`
- Draws **each keyframe**:
  - A clickable, draggable `<g>`
  - Background circle (radius 0.04 SVG, fill `#ff7a3c`, stroke `#0a0a0a` width 0.008)
  - Stable number text in the centre, size 0.05, fill `#0a0a0a`, anchor middle
  - If selected: outer dashed ring (radius 0.06, stroke `#ff7a3c`, dasharray)
- Draws the **listener** at the centre: blue circle radius 0.05 fill `#5b9dff` + small triangle pointing forward (towards `−z` in top view, also towards `−z` in side view).
- Draws the **current position** (source at `interpolatePosition(keyframes, currentTime)`) as a light orange circle radius 0.025, no number, subtle halo (only visible during playback).

### 4. Mouse interactions

Implement hit-testing in SVG via `onPointerDown` / `onPointerMove` / `onPointerUp` on the root `<svg>`, and `event.target.closest('[data-kf-id]')` to detect keyframes.

- **Click in empty space**: adds a keyframe at the clicked position (at the current time). The 3rd coordinate (Y for TOP, X for SIDE) keeps the current interpolated value (continuity).
- **Click on keyframe**: selects (`selectKeyframe(id)`).
- **Drag a keyframe**: updates its 2D coordinates in the view's plane. Emits a `moveKeyframe` at most every 16 ms (throttle).
- **Angular snap**: if `snapAngleDeg > 0`, during a drag, compute the polar angle `θ = atan2(v, u)` and the distance `r = √(u² + v²)`. Snap `θ` to the nearest multiple of `snapAngleDeg`. Keep `r` free.
- **Delete**: if a keyframe is selected, delete it (already handled in the keyboard hook, just verify it works from this view).

### 5. Pixel → world coordinate conversion

In the `onPointerDown` handler:

```ts
const rect = svgRef.current.getBoundingClientRect();
const px = (e.clientX - rect.left) / rect.width;   // 0..1
const py = (e.clientY - rect.top) / rect.height;
const viewBoxSize = 2.4 / zoom;
const svgX = (px - 0.5) * viewBoxSize;
const svgY = (py - 0.5) * viewBoxSize;
// inverse projection:
// top  : x =  svgX,  z = -svgY
// side : z =  svgX,  y = -svgY
```

### 6. Bottom info bar and floating buttons

Inside the component, below the `<svg>`:

```tsx
<div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono text-neutral-500">
  <span>cur {axis1}{format(u)}  {axis2}{format(v)}  az {angleDeg}°</span>
  <div className="flex gap-1">
    <button title="Auto-fit (1.0×)" onClick={() => setZoom(1)}><MaximizeIcon /></button>
    <button title="Recenter" onClick={recenter}><CrosshairIcon /></button>
    <button title="Lock" onClick={toggleLock}><LockIcon /></button>
  </div>
</div>
```

And a header above the SVG:

```tsx
<div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono text-neutral-500">
  <span>{label}  <span className="text-neutral-700 ml-1">{plane}</span>  {zoom.toFixed(1)}×</span>
  <span className="flex items-center gap-2">
    Snap {snapAngleDeg}°  <span className="size-1.5 rounded-full bg-emerald-400" /> HRTF
  </span>
</div>
```

### 7. Main layout

In `App.tsx`, place the two views side by side with `flex-1` each and a thin separator:

```tsx
<main className="flex-1 grid grid-cols-[1fr_1fr_320px] grid-rows-[1fr_auto_auto]">
  <OrthographicView projection="top"  className="border-r border-neutral-900" />
  <OrthographicView projection="side" />
  <Inspector className="row-span-3 border-l border-neutral-900" />
  <Waveform className="col-span-2 border-t border-neutral-900" />
  <TransportBar className="col-span-2 border-t border-neutral-900" />
</main>
```

### 8. Stable keyframe numbering

Keyframes are identified by UUID internally. The `1, 2, 3 …` display is computed from the sort by `time`. Create a memoised Zustand selector:

```ts
const useKeyframesByTime = () => useProjectStore((s) =>
  [...(s.project?.keyframes ?? [])].sort((a, b) => a.time - b.time)
);
```

The index in this array + 1 → displayed number. Also handy for the timeline bar (phase 4).

## Acceptance criterion

- The app loads an audio file then shows TOP and SIDE side by side, empty at first (just the central listener).
- Clicking in the TOP view adds a keyframe at the right X/Z position, and it appears immediately in both views.
- Clicking a keyframe selects it; the selected one has a visible dashed halo in both views.
- Dragging the selected keyframe in TOP modifies X/Z, in SIDE modifies Z/Y. Both views stay in sync.
- During playback, a light-orange cursor moves along the interpolated path.
- 15° snap works: the polar angle jumps by visible steps.
- The "auto-fit" button resets zoom to 1.0.
- The lock disables mouse interactions (but not keyboard selection).

## Notes for the agent

- For icons: use `lucide-react` (`Maximize`, `Crosshair`, `Lock`).
- Keep everything inline SVG. No Canvas, no WebGL at this stage — the 3D will only be added later if we extend the app with a bonus PERSPECTIVE view.
- Performance: 50 keyframes max in a realistic project, so a full React re-render every playback frame is acceptable. If you notice stutters, memoise the SVG paths with `useMemo` (key: sorted `keyframes`).

## Commit

```
feat(phase-3b): TOP + SIDE orthographic views in SVG
```
