# Phase 3b — Vues orthographiques TOP + SIDE

> **Cette phase REMPLACE la phase 3 originale** (`tasks/phase-3-spatial-ui.md`). Ne fais pas la phase 3, fais celle-ci à la place.

## Objectif

Construire **deux vues 2D orthographiques côte à côte** (TOP : plan X/Z vu du dessus ; SIDE : plan Z/Y vu de profil) à la place d'une scène 3D Three.js. Chaque vue affiche :

- Cercles concentriques de référence (rayons 0.25, 0.5, 0.75, 1.0)
- Axes labellisés (`-X`, `+X`, `-Z`, `+Z`, `-Y`, `+Y`)
- L'auditeur au centre (point bleu avec petit cône directionnel)
- Tous les keyframes (cercles orange numérotés `1`, `2`, … selon l'ordre temporel)
- Le keyframe sélectionné mis en valeur (anneau pointillé autour)
- Un chemin pointillé reliant les keyframes dans l'ordre temporel
- La position courante interpolée pendant la lecture (curseur orange différencié des keyframes)
- Bandeau d'information en bas : `cur x +0.62  z +0.30  az +62°`
- Commandes flottantes en bas à droite : zoom (auto-fit), centrer, cadenas (lock view)

L'utilisateur peut **cliquer dans le vide** pour ajouter un keyframe à cette position projetée (la coordonnée non visible reste à sa valeur courante interpolée), **cliquer sur un keyframe** pour le sélectionner, et **glisser** un keyframe pour déplacer ses coordonnées dans le plan visible.

## Pourquoi 2D et pas 3D ?

Une scène Three.js 3D avec OrbitControls oblige l'utilisateur à manipuler la caméra avant de pouvoir éditer un point — friction inutile. Deux orthos figées sont plus rapides à utiliser, plus précises, et plus lisibles à l'écran (pas de problème de perspective qui rend les distances trompeuses). Tous les éditeurs spatial audio professionnels (Dolby Atmos Renderer, dearVR, etc.) utilisent ce paradigme.

## Étapes

### 1. Pas de Three.js dans cette phase

Ne pas installer `three`, `@react-three/fiber`, `@react-three/drei`. Tout se fait en **SVG** dans React, c'est suffisamment performant pour une dizaine de keyframes et permet un styling Tailwind direct.

### 2. Définir les types et le store (extensions)

Étendre `src/types/project.ts` avec :

```ts
export type Projection = 'top' | 'side';

export interface ViewState {
  zoom: number;          // 1.0 = sphère unité tient dans la vue
  locked: boolean;       // si true, ignore clics et drags
}
```

Étendre le store avec :

```ts
viewStates: { top: ViewState; side: ViewState };
snapAngleDeg: number;       // 0 = pas de snap, sinon 5/10/15/30/45/90
setViewState: (which: Projection, partial: Partial<ViewState>) => void;
setSnapAngle: (deg: number) => void;
addKeyframeAtProjection: (proj: Projection, u: number, v: number) => void;
moveKeyframe: (id: string, proj: Projection, u: number, v: number) => void;
```

Où `(u, v)` sont les coordonnées normalisées dans le plan de la vue : pour `top`, `u = x`, `v = z` ; pour `side`, `u = z`, `v = y`.

### 3. Composant `OrthographicView`

Crée `src/components/scene/OrthographicView.tsx`. Signature :

```tsx
interface OrthographicViewProps {
  projection: Projection;
  className?: string;
}
```

Comportement :

- Rend un `<svg viewBox="-1.2 -1.2 2.4 2.4" preserveAspectRatio="xMidYMid meet">` (l'origine au centre, ±1.2 d'amplitude pour laisser un peu d'air autour de la sphère unité).
- Le viewBox est multiplié par `1 / zoom` pour gérer le zoom.
- **Conversion coordonnées** : un point world `(x, y, z)` se projette en SVG :
  - `top` : `(svgX, svgY) = (x, -z)` → -Z en haut, +Z en bas, conformément au screenshot
  - `side` : `(svgX, svgY) = (z, -y)` → -Y en haut, +Y en bas (Y inversé pour cohérence avec orientation visuelle « tête en haut »)
- Dessine en arrière-plan :
  - 4 cercles concentriques (rayons 0.25, 0.5, 0.75, 1.0) en stroke `#2a2a2a`, dasharray pour les 3 internes, plein pour le rayon 1.0
  - Croix d'axes (lignes `−1.2 → 1.2` horizontale et verticale) en `#1f1f1f`
  - Labels d'axes en texte SVG, taille `0.06`, fill `#666` ; positions sur les bords du viewBox
- Dessine le **chemin** :
  - Trie les keyframes par `time`
  - Construit un `<path d="M x1 y1 L x2 y2 …">` avec `stroke="#ff7a3c66"` (orange transparent) et `stroke-dasharray="0.02 0.02"`
- Dessine **chaque keyframe** :
  - `<g>` cliquable et draggable
  - Cercle de fond (rayon 0.04 SVG, fill `#ff7a3c`, stroke `#0a0a0a` largeur 0.008)
  - Texte du numéro stable au centre, taille 0.05, fill `#0a0a0a`, anchor middle
  - Si sélectionné : anneau extérieur pointillé (rayon 0.06, stroke `#ff7a3c`, dasharray)
- Dessine **l'auditeur** au centre : cercle bleu rayon 0.05 fill `#5b9dff` + petit triangle orienté forward (pointe vers `−z` dans top view, vers `−z` aussi dans side view).
- Dessine la **position courante** (source à `interpolatePosition(keyframes, currentTime)`) en cercle orange clair rayon 0.025, sans numéro, halo subtil (dur uniquement à la lecture).

### 4. Interactions souris

Implémente le hit-testing en SVG via `onPointerDown` / `onPointerMove` / `onPointerUp` sur le `<svg>` racine, et `event.target.closest('[data-kf-id]')` pour détecter les keyframes.

- **Clic dans le vide** : ajoute un keyframe à la position cliquée (au temps courant). La 3e coordonnée (Y pour TOP, X pour SIDE) reprend la valeur interpolée courante (continuité).
- **Clic sur keyframe** : sélectionne (`selectKeyframe(id)`).
- **Drag d'un keyframe** : met à jour ses coordonnées 2D dans le plan de la vue. Émet un `moveKeyframe` toutes les 16 ms max (throttle).
- **Snap angulaire** : si `snapAngleDeg > 0`, lors d'un drag, calcule l'angle polaire `θ = atan2(v, u)` et la distance `r = √(u² + v²)`. Snap `θ` au multiple le plus proche de `snapAngleDeg`. Garde `r` libre.
- **Suppr** : si keyframe sélectionné, le supprimer (déjà géré dans le hook clavier, vérifier que ça marche depuis cette vue).

### 5. Conversion pixel → coordonnée world

Dans le handler `onPointerDown` :

```ts
const rect = svgRef.current.getBoundingClientRect();
const px = (e.clientX - rect.left) / rect.width;   // 0..1
const py = (e.clientY - rect.top) / rect.height;
const viewBoxSize = 2.4 / zoom;
const svgX = (px - 0.5) * viewBoxSize;
const svgY = (py - 0.5) * viewBoxSize;
// projection inverse :
// top  : x =  svgX,  z = -svgY
// side : z =  svgX,  y = -svgY
```

### 6. Bandeau d'info bas et boutons flottants

Dans le composant, sous le `<svg>` :

```tsx
<div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono text-neutral-500">
  <span>cur {axis1}{format(u)}  {axis2}{format(v)}  az {angleDeg}°</span>
  <div className="flex gap-1">
    <button title="Auto-fit (1.0×)" onClick={() => setZoom(1)}><MaximizeIcon /></button>
    <button title="Recentrer" onClick={recenter}><CrosshairIcon /></button>
    <button title="Verrouiller" onClick={toggleLock}><LockIcon /></button>
  </div>
</div>
```

Et un en-tête au-dessus du SVG :

```tsx
<div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono text-neutral-500">
  <span>{label}  <span className="text-neutral-700 ml-1">{plane}</span>  {zoom.toFixed(1)}×</span>
  <span className="flex items-center gap-2">
    Snap {snapAngleDeg}°  <span className="size-1.5 rounded-full bg-emerald-400" /> HRTF
  </span>
</div>
```

### 7. Layout principal

Dans `App.tsx`, mettre les deux vues côte à côte avec `flex-1` chacune et un séparateur fin :

```tsx
<main className="flex-1 grid grid-cols-[1fr_1fr_320px] grid-rows-[1fr_auto_auto]">
  <OrthographicView projection="top"  className="border-r border-neutral-900" />
  <OrthographicView projection="side" />
  <Inspector className="row-span-3 border-l border-neutral-900" />
  <Waveform className="col-span-2 border-t border-neutral-900" />
  <TransportBar className="col-span-2 border-t border-neutral-900" />
</main>
```

### 8. Numérotation stable des keyframes

Les keyframes sont identifiés par UUID en interne. L'affichage `1, 2, 3 …` est calculé à partir du tri par `time`. Crée un sélecteur Zustand mémoïsé :

```ts
const useKeyframesByTime = () => useProjectStore((s) =>
  [...(s.project?.keyframes ?? [])].sort((a, b) => a.time - b.time)
);
```

L'index dans ce tableau + 1 → numéro affiché. Pratique aussi pour la barre de timeline (phase 4).

## Critère d'acceptation

- L'app charge un audio puis affiche TOP et SIDE côte à côte, vides au début (juste l'auditeur central).
- Cliquer dans la vue TOP ajoute un keyframe à la bonne position X/Z, et il apparaît immédiatement dans les deux vues.
- Cliquer sur un keyframe le sélectionne ; le sélectionné a un halo pointillé visible dans les deux vues.
- Glisser le keyframe sélectionné dans TOP modifie X/Z, dans SIDE modifie Z/Y. Les deux vues se synchronisent.
- Pendant la lecture, un curseur orange clair se déplace le long du chemin interpolé.
- Snap 15° fonctionne : l'angle polaire saute par paliers visibles.
- Le bouton « auto-fit » remet le zoom à 1.0.
- Le cadenas désactive les interactions souris (mais pas la sélection clavier).

## Notes pour l'agent

- Pour les icônes : utilise `lucide-react` (`Maximize`, `Crosshair`, `Lock`).
- Garde tout en SVG inline. Pas de Canvas, pas de WebGL à ce stade — la 3D ne sera ajoutée que si on étend l'app plus tard avec une vue PERSPECTIVE bonus.
- Performance : 50 keyframes maxi dans un projet réaliste, donc un re-render React complet à chaque frame de lecture est acceptable. Si tu remarques des saccades, mémoïse les chemins SVG avec `useMemo` (clé : `keyframes` triés).

## Commit

```
feat(phase-3b): vues orthographiques TOP + SIDE en SVG
```
