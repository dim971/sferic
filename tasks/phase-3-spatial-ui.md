# Phase 3 — 3D spatial scenes (dual view)

## Goal

Build **two 3D scenes** with Three.js (via React Three Fiber) side by side (see `DESIGN.md §4`):
- `SceneTop` (orthographic camera above, looking down -Y).
- `ScenePerspective` (perspective camera + `OrbitControls`).

Both display the same content:
- A **listener** at the centre (small blue sphere `--listener` radius 0.04).
- A **reference sphere** wireframe orange `--accent` radius 1, opacity 0.18.
- A **trajectory** in semi-transparent orange linking the interpolated keyframe positions (≥ 2 keyframes required).
- All **keyframes** as numbered orange markers, larger + halo when selected.
- The **current sound source** (interpolated position at playback time) as an orange sphere with a pronounced halo.

The user can **click in the Perspective scene** to add a keyframe (the position is projected onto the unit sphere if `settings.snapToSphere`).

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add three @react-three/fiber @react-three/drei
   pnpm add -D @types/three
   ```

2. **Create `src/lib/math3d.ts`** (`CurveType` = `'linear' | 'eaze' | 'smooth' | 'step'`):
   ```ts
   import type { CurveType, SpatialKeyframe } from '@/types/project';

   export function applyCurve(t: number, curve: CurveType): number {
     switch (curve) {
       case 'linear': return t;
       case 'eaze':   return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; // ease-in-out
       case 'smooth': return t * t * (3 - 2 * t);                              // smoothstep
       case 'step':   return t < 1 ? 0 : 1;
     }
   }

   export function interpolatePosition(
     keyframes: SpatialKeyframe[],
     timeSec: number
   ): { x: number; y: number; z: number } {
     if (keyframes.length === 0) return { x: 0, y: 0, z: -1 };
     const sorted = [...keyframes].sort((a, b) => a.time - b.time);
     if (timeSec <= sorted[0].time) return sorted[0].position;
     if (timeSec >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].position;
     for (let i = 0; i < sorted.length - 1; i++) {
       const a = sorted[i], b = sorted[i + 1];
       if (timeSec >= a.time && timeSec <= b.time) {
         const raw = (timeSec - a.time) / (b.time - a.time);
         const t = applyCurve(raw, b.curve);
         return {
           x: a.position.x + (b.position.x - a.position.x) * t,
           y: a.position.y + (b.position.y - a.position.y) * t,
           z: a.position.z + (b.position.z - a.position.z) * t,
         };
       }
     }
     return sorted[sorted.length - 1].position;
   }
   ```

3. **Extend the store**: add actions
   - `addKeyframe(position, time?)` (time = currentTime if omitted)
   - `updateKeyframe(id, partial)`
   - `removeKeyframe(id)`
   - `selectKeyframe(id | null)`

4. **Create a shared scene component `src/components/scene/SceneContents.tsx`** that renders all the content shared between the two views (orange wireframe sphere, listener, current source, keyframes, trajectory). No `<Canvas>` here — just the R3F scenegraph:
   ```tsx
   import { Html } from '@react-three/drei';
   import { useProjectStore } from '@/store/project-store';
   import { interpolatePosition, samplePath } from '@/lib/math3d';
   import { Listener } from './Listener';
   import { Source } from './Source';
   import { KeyframeMarker } from './KeyframeMarker';
   import { TrajectoryLine } from './TrajectoryLine';

   export function SceneContents() {
     const project = useProjectStore((s) => s.project);
     const keyframes = project?.keyframes ?? [];
     const currentTime = useProjectStore((s) => s.playback.currentTime);
     const sourcePos = interpolatePosition(keyframes, currentTime);
     return (
       <>
         <ambientLight intensity={0.5} />
         {/* Orange wireframe sphere (see DESIGN §4.1) */}
         <mesh>
           <sphereGeometry args={[1, 20, 16]} />
           <meshBasicMaterial color="#F87328" wireframe transparent opacity={0.18} />
         </mesh>
         <Listener />
         <TrajectoryLine keyframes={keyframes} />
         <Source position={[sourcePos.x, sourcePos.y, sourcePos.z]} />
         {keyframes.map((kf, i) => (
           <KeyframeMarker key={kf.id} index={i + 1} keyframe={kf} />
         ))}
       </>
     );
   }
   ```

5. **Create `src/components/scene/SceneTop.tsx`** — top-down orthographic view, non-controllable camera:
   ```tsx
   import { Canvas, OrthographicCamera } from '@react-three/fiber';
   import { SceneContents } from './SceneContents';

   export function SceneTop() {
     return (
       <Canvas orthographic camera={{ position: [0, 5, 0], zoom: 200, near: 0.1, far: 100 }}
               className="bg-[--bg-panel]">
         <SceneContents />
         {/* No OrbitControls: fixed view */}
       </Canvas>
     );
   }
   ```
   HTML overlay (see `DESIGN §4.2`): `TOP` label top-left, current timecode top-right, `+1.0`/`-1.0` markers at the edges.

6. **Create `src/components/scene/ScenePerspective.tsx`** — free camera:
   ```tsx
   import { Canvas } from '@react-three/fiber';
   import { OrbitControls } from '@react-three/drei';
   import { SceneContents } from './SceneContents';
   import { ClickToPlace } from './ClickToPlace';

   export function ScenePerspective() {
     return (
       <Canvas camera={{ position: [2.5, 2, 2.5], fov: 50 }} className="bg-[--bg-panel]">
         <SceneContents />
         <ClickToPlace />
         <OrbitControls makeDefault enablePan={false} minDistance={2} maxDistance={8} />
       </Canvas>
     );
   }
   ```
   HTML overlay: `PERSPECTIVE` label, timecode, azimuth/elevation readout at the bottom.

7. **Create `src/components/scene/DualScene.tsx`**:
   ```tsx
   import { SceneTop } from './SceneTop';
   import { ScenePerspective } from './ScenePerspective';

   export function DualScene() {
     return (
       <div className="grid grid-cols-2 h-full">
         <div className="border-r border-[--border-subtle]"><SceneTop /></div>
         <ScenePerspective />
       </div>
     );
   }
   ```

8. **Create `Listener.tsx`**: small solid `--listener` (`#4F8EF7`) sphere radius 0.04 at the origin. No directional cone (the listener is fixed).

9. **Create `Source.tsx`**: orange `--accent` sphere radius 0.06 at the interpolated position, with a halo sprite (`<sprite>` + circular texture or `<mesh>` + additive material) wider (radius 0.18, opacity 0.4).

10. **Create `TrajectoryLine.tsx`**: use `<Line>` from drei to draw the interpolated trajectory (≥ 2 keyframes). 64-segment sampling, colour `#F87328`, opacity 0.6, width 2. Implement a `samplePath(keyframes, n)` function in `math3d.ts` that calls `interpolatePosition` at n times spread over `[firstKf.time, lastKf.time]`.

11. **Create `KeyframeMarker.tsx`** (see `DESIGN §4.1`):
    - Solid `--accent` sphere radius 0.05; `--accent-hot` 1px outline (via a second slightly larger mesh in `meshBasicMaterial wireframe` or outline shader).
    - Floating numeric label via drei's `<Html>`: `<span className="text-[10px] text-white">{index}</span>`.
    - `onClick` (R3F event) → `selectKeyframe(kf.id)`.
    - `onPointerDown` + drag → `updateKeyframe(id, { position })`. Reproject onto the unit sphere if `settings.snapToSphere || kf.snap`.
    - If selected → radius 0.08, halo (circular sprite 0.18 transparent `--accent`), expanded label (`Keyframe NN — m:ss.cc`).

12. **Create `ClickToPlace.tsx`** (only in `ScenePerspective`):
    - Invisible mesh (sphere of radius 1.5) that captures clicks in empty space.
    - `onPointerDown`:
      - Get the intersection point.
      - If `settings.snapToSphere` → `pos.normalize()` (radius = 1).
      - Call `addKeyframe({ x, y, z }, currentTime)` with `snap: settings.snapToSphere`.

13. **Layout**: replace the scenes-area placeholder (created in phase 1) with `<DualScene />`. The layout skeleton (44px / 1fr / 180px × 1fr / 320px, see `DESIGN §2`) is already in place since phase 1. The "Inspector" cell stays empty — phase 4 fills it.

## Design

Ref: `DESIGN.md §4` (full DualScene — palette, markers, overlays, interactions). Compare pixel-by-pixel with the screenshot: the wireframe sphere should be discreet (opacity ≈ 0.18), the orange markers should clearly stand out, the blue listener should be a point inside the wireframe (not a big sphere). The semi-transparent orange trajectory is a **strong** signal that the path between keyframes is being read — without it the scene falls flat.

The HTML overlays (TOP/PERSPECTIVE labels, timecode, coordinate markers) are essential for the polished look — don't skip them.

## Acceptance criterion

- When a file is loaded, **both** scenes appear with listener, orange wireframe sphere, and a default source in front of the listener.
- Clicking on the sphere in the Perspective view adds an orange keyframe at that spot (snap-to-sphere on by default).
- The keyframe is clickable, selectable, and its selected state is consistent across both views.
- Dragging a selected keyframe updates its position in real time in both views.
- `OrbitControls` rotate/zoom works in the Perspective view only (the Top view stays fixed).
- The orange trajectory connects ≥ 2 keyframes correctly.
- The orange source moves along the trajectory during playback (`linear` interpolation is enough for phase 3, the other curves arrive in phase 5).
- Visually, compare with the screenshot — colours, wireframe thickness, marker size, halo on the selected keyframe.

## Commit

```
feat(phase-3): 3D Three.js scene with interactive keyframes
```
