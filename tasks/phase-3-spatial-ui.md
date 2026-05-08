# Phase 3 — Scène spatiale 3D

## Objectif

Construire une scène 3D Three.js (via React Three Fiber) qui affiche :
- Un **auditeur** au centre (sphère bleue représentant la tête).
- Une **sphère de référence** wireframe de rayon 1.
- Une **source sonore** (sphère orange) positionnée selon la valeur courante interpolée des keyframes.
- Tous les **keyframes** sous forme de petites sphères grises interactives.

L'utilisateur peut **cliquer dans la scène** pour ajouter un keyframe à la position cliquée et au temps courant.

## Étapes

1. **Installer les dépendances** :
   ```bash
   pnpm add three @react-three/fiber @react-three/drei
   pnpm add -D @types/three
   ```

2. **Créer `src/lib/math3d.ts`** :
   ```ts
   import type { CurveType, SpatialKeyframe } from '@/types/project';

   export function applyCurve(t: number, curve: CurveType): number {
     switch (curve) {
       case 'linear': return t;
       case 'easeIn': return t * t;
       case 'easeOut': return 1 - (1 - t) * (1 - t);
       case 'easeInOut': return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
       case 'step': return t < 1 ? 0 : 1;
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

3. **Étendre le store** : ajouter actions
   - `addKeyframe(position, time?)` (time = currentTime si omis)
   - `updateKeyframe(id, partial)`
   - `removeKeyframe(id)`
   - `selectKeyframe(id | null)`

4. **Créer `src/components/scene/SpatialScene.tsx`** :
   ```tsx
   import { Canvas } from '@react-three/fiber';
   import { OrbitControls, Sphere, Wireframe, Grid } from '@react-three/drei';
   import { useProjectStore } from '@/store/project-store';
   import { interpolatePosition } from '@/lib/math3d';
   import { Listener } from './Listener';
   import { Source } from './Source';
   import { KeyframeMarker } from './KeyframeMarker';
   import { ClickToPlace } from './ClickToPlace';

   export function SpatialScene() {
     const project = useProjectStore((s) => s.project);
     const keyframes = project?.keyframes ?? [];
     const currentTime = useProjectStore((s) => s.playback.currentTime);
     const sourcePos = interpolatePosition(keyframes, currentTime);

     return (
       <Canvas camera={{ position: [2.5, 2, 2.5], fov: 50 }} className="bg-neutral-900">
         <ambientLight intensity={0.4} />
         <pointLight position={[5, 5, 5]} intensity={1} />
         <Grid args={[4, 4]} cellColor="#333" sectionColor="#555" infiniteGrid={false} />
         <mesh>
           <sphereGeometry args={[1, 32, 16]} />
           <meshBasicMaterial color="#444" wireframe transparent opacity={0.25} />
         </mesh>
         <Listener />
         <Source position={[sourcePos.x, sourcePos.y, sourcePos.z]} />
         {keyframes.map((kf) => (
           <KeyframeMarker key={kf.id} keyframe={kf} />
         ))}
         <ClickToPlace />
         <OrbitControls makeDefault enablePan={false} minDistance={2} maxDistance={8} />
       </Canvas>
     );
   }
   ```

5. **Créer `Listener.tsx`** : sphère bleue à l'origine + petit cône `forward` vers -Z.

6. **Créer `Source.tsx`** : sphère orange émissive à la position interpolée + ligne pointillée vers l'auditeur.

7. **Créer `KeyframeMarker.tsx`** :
   - Petite sphère grise.
   - `onClick` (R3F event) → `selectKeyframe(kf.id)`.
   - Si sélectionné → matière émissive et halo.

8. **Créer `ClickToPlace.tsx`** :
   - Mesh invisible (sphère de rayon 1.5) qui capture les clics dans le vide.
   - `onPointerDown` :
     - Récupère le point d'intersection.
     - **Projette sur la sphère unité** : `pos.normalize()`.
     - Appelle `addKeyframe({ x, y, z }, currentTime)`.

9. **Layout** : modifier `App.tsx` pour avoir une grille :
   ```
   ┌────────────────────────────────────┐
   │              Topbar                 │
   ├──────────────────────┬──────────────┤
   │                      │              │
   │    SpatialScene      │  Inspector   │  (Inspector vide pour l'instant)
   │                      │              │
   ├──────────────────────┴──────────────┤
   │            Waveform                 │
   ├─────────────────────────────────────┤
   │           TransportBar              │
   └─────────────────────────────────────┘
   ```
   Utiliser `grid grid-rows-[auto_1fr_auto_auto] grid-cols-[1fr_320px]`.

## Critère d'acceptation

- Au chargement d'un fichier, la scène 3D apparaît avec auditeur, sphère wireframe, source par défaut devant l'auditeur.
- Cliquer sur la sphère wireframe ajoute un keyframe gris à cet endroit.
- Le keyframe est cliquable et change visuellement quand sélectionné.
- OrbitControls permet de tourner autour de la scène.
- La source orange se déplace en suivant les keyframes lors de la lecture (interpolation linéaire suffit pour l'instant, l'audio HRTF est encore fixe).

## Commit

```
feat(phase-3): scène 3D Three.js avec keyframes interactifs
```
