# Phase 3 — Scènes spatiales 3D (dual view)

## Objectif

Construire **deux scènes 3D** Three.js (via React Three Fiber) côte à côte (cf. `DESIGN.md §4`) :
- `SceneTop` (caméra orthographique au-dessus, regard vers -Y).
- `ScenePerspective` (caméra perspective + `OrbitControls`).

Les deux affichent le même contenu :
- Un **auditeur** au centre (petite sphère bleue `--listener` rayon 0.04).
- Une **sphère de référence** wireframe orange `--accent` rayon 1, opacité 0.18.
- Une **trajectoire** orange semi-transparente reliant les positions interpolées des keyframes (≥ 2 keyframes requis).
- Tous les **keyframes** sous forme de marqueurs orange numérotés, plus grands + halo quand sélectionnés.
- La **source sonore courante** (position interpolée au temps de lecture) en sphère orange avec halo prononcé.

L'utilisateur peut **cliquer dans la scène Perspective** pour ajouter un keyframe (la position est projetée sur la sphère unité si `settings.snapToSphere`).

## Étapes

1. **Installer les dépendances** :
   ```bash
   pnpm add three @react-three/fiber @react-three/drei
   pnpm add -D @types/three
   ```

2. **Créer `src/lib/math3d.ts`** (`CurveType` = `'linear' | 'eaze' | 'smooth' | 'step'`) :
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

3. **Étendre le store** : ajouter actions
   - `addKeyframe(position, time?)` (time = currentTime si omis)
   - `updateKeyframe(id, partial)`
   - `removeKeyframe(id)`
   - `selectKeyframe(id | null)`

4. **Créer un composant scène partagée `src/components/scene/SceneContents.tsx`** qui rend tout le contenu commun aux deux vues (sphère wireframe orange, listener, source courante, keyframes, trajectoire). Aucune `<Canvas>` ici — juste le scenegraph R3F :
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
         {/* Sphère wireframe orange (cf. DESIGN §4.1) */}
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

5. **Créer `src/components/scene/SceneTop.tsx`** — vue plongeante orthographique, caméra non-controllable :
   ```tsx
   import { Canvas, OrthographicCamera } from '@react-three/fiber';
   import { SceneContents } from './SceneContents';

   export function SceneTop() {
     return (
       <Canvas orthographic camera={{ position: [0, 5, 0], zoom: 200, near: 0.1, far: 100 }}
               className="bg-[--bg-panel]">
         <SceneContents />
         {/* Pas d'OrbitControls : vue figée */}
       </Canvas>
     );
   }
   ```
   Overlay HTML (cf. `DESIGN §4.2`) : label `TOP` en haut-gauche, timecode courant en haut-droit, repères `+1.0`/`-1.0` aux bords.

6. **Créer `src/components/scene/ScenePerspective.tsx`** — caméra libre :
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
   Overlay HTML : label `PERSPECTIVE`, timecode, lecture d'azimut/élévation en bas.

7. **Créer `src/components/scene/DualScene.tsx`** :
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

8. **Créer `Listener.tsx`** : petite sphère pleine `--listener` (`#4F8EF7`) rayon 0.04 à l'origine. Pas de cône directionnel (l'auditeur est fixe).

9. **Créer `Source.tsx`** : sphère orange `--accent` rayon 0.06 à la position interpolée, avec un sprite halo (`<sprite>` + texture circulaire ou `<mesh>` + matériau additif) plus large (rayon 0.18, opacité 0.4).

10. **Créer `TrajectoryLine.tsx`** : utilise `<Line>` de drei pour tracer la trajectoire interpolée (≥ 2 keyframes). Échantillonnage 64 segments, couleur `#F87328`, opacité 0.6, épaisseur 2. Implémenter une fonction `samplePath(keyframes, n)` dans `math3d.ts` qui appelle `interpolatePosition` à n temps répartis sur `[firstKf.time, lastKf.time]`.

11. **Créer `KeyframeMarker.tsx`** (cf. `DESIGN §4.1`) :
    - Sphère pleine `--accent` rayon 0.05 ; bord `--accent-hot` 1px (via second mesh légèrement plus grand en `meshBasicMaterial wireframe` ou outline shader).
    - Label numérique flottant via `<Html>` de drei : `<span className="text-[10px] text-white">{index}</span>`.
    - `onClick` (R3F event) → `selectKeyframe(kf.id)`.
    - `onPointerDown` + drag → `updateKeyframe(id, { position })`. Reprojection sur sphère unité si `settings.snapToSphere || kf.snap`.
    - Si sélectionné → rayon 0.08, halo (sprite circulaire 0.18 transparent `--accent`), label étendu (`Keyframe NN — m:ss.cc`).

12. **Créer `ClickToPlace.tsx`** (uniquement dans `ScenePerspective`) :
    - Mesh invisible (sphère de rayon 1.5) qui capture les clics dans le vide.
    - `onPointerDown` :
      - Récupère le point d'intersection.
      - Si `settings.snapToSphere` → `pos.normalize()` (rayon = 1).
      - Appelle `addKeyframe({ x, y, z }, currentTime)` avec `snap: settings.snapToSphere`.

13. **Layout** : remplacer le placeholder de la zone scènes (créé en phase 1) par `<DualScene />`. Le squelette du layout (44px / 1fr / 180px × 1fr / 320px, cf. `DESIGN §2`) est déjà en place depuis phase 1. La cellule "Inspector" reste vide — phase 4 la remplit.

## Design

Réf : `DESIGN.md §4` (DualScene complet — palette, marqueurs, overlays, interactions). Comparer pixel-à-pixel avec le screenshot : la sphère wireframe doit être discrète (opacité ≈ 0.18), les marqueurs orange doivent ressortir nettement, l'auditeur bleu doit être un point parmi le wireframe (pas une grosse sphère). La trajectoire orange semi-transparente est un signal **fort** que le path entre keyframes est lu — son absence rend la scène fade.

Les overlays HTML (labels TOP/PERSPECTIVE, timecode, repères de coordonnées) sont indispensables au rendu pro — ne pas les sauter.

## Critère d'acceptation

- Au chargement d'un fichier, les **deux** scènes apparaissent avec auditeur, sphère wireframe orange, et source par défaut devant l'auditeur.
- Cliquer sur la sphère dans la vue Perspective ajoute un keyframe orange à cet endroit (snap-to-sphere actif par défaut).
- Le keyframe est cliquable, sélectionnable, et son état sélectionné est cohérent dans les deux vues.
- Drag d'un keyframe sélectionné met à jour sa position en temps réel dans les deux vues.
- `OrbitControls` rotate/zoom fonctionne dans la vue Perspective uniquement (la vue Top reste fixe).
- La trajectoire orange relie ≥ 2 keyframes correctement.
- La source orange se déplace en suivant la trajectoire lors de la lecture (interpolation `linear` suffit en phase 3, les autres curves arrivent en phase 5).
- Visuellement, comparer au screenshot — couleurs, épaisseur de wireframe, taille des marqueurs, halo du keyframe sélectionné.

## Commit

```
feat(phase-3): scène 3D Three.js avec keyframes interactifs
```
