# Phase 4 — Timeline avec marqueurs et inspecteur

## Objectif

Lier la timeline (forme d'onde) aux keyframes :
- Afficher chaque keyframe comme un marqueur vertical sur la waveform.
- Cliquer sur la waveform → seek + (en mode "ajout") → ajouter un keyframe.
- Inspecteur latéral pour éditer les propriétés du keyframe sélectionné.

## Étapes

1. **Étendre `Waveform.tsx`** :
   - Synchroniser le curseur WaveSurfer avec `playback.currentTime` du store.
   - Sur `ws.on('seek', ...)`, appeler `seek()` du store.
   - Désactiver le seek auto-géré de WaveSurfer si nécessaire pour rester source unique.

2. **Ajouter le plugin Markers / Regions** de WaveSurfer pour les keyframes :
   ```bash
   pnpm add wavesurfer.js
   ```
   Utiliser `RegionsPlugin` ou créer un overlay simple :
   - Calque absolu `position: relative` sur le conteneur waveform.
   - Pour chaque keyframe, un trait vertical à `left: (kf.time / duration) * 100%`.
   - `onClick` du trait → `selectKeyframe(kf.id)`.

3. **Créer `src/components/inspector/Inspector.tsx`** :
   - Si pas de keyframe sélectionné → afficher les **settings projet** :
     - Toggle `panningModel` (HRTF / equalpower)
     - Slider `refDistance`, `rolloffFactor`
     - Toggle `reverb.enabled` + slider `reverb.wet`
   - Si keyframe sélectionné → afficher :
     - Time (input number, en secondes, 2 décimales)
     - Position X, Y, Z (sliders -1 → 1)
     - Curve (select : linear/easeIn/easeOut/easeInOut/step)
     - Label (input text optionnel)
     - Bouton "Supprimer"

4. **Comportement de la waveform** :
   - **Clic simple** sur la waveform → seek.
   - **Shift + clic** → ajoute un keyframe à ce temps, à la position 3D courante de la source (ou à `(0,0,-1)` si aucun keyframe avant).
   - Indiquer ces raccourcis dans une légende discrète sous la timeline.

5. **Styliser les marqueurs de keyframes** :
   - Trait vertical 2px, couleur grise (`#888`), arrondi en haut.
   - Si sélectionné : couleur orange, halo, bouton "X" pour supprimer apparaissant au hover.

6. **Ajouter raccourcis clavier** dans un hook `useKeyboardShortcuts()` :
   - `Espace` → play/pause
   - `Suppr` → supprimer le keyframe sélectionné
   - `Esc` → désélectionner
   - `Cmd/Ctrl+S` → save (pour la phase 7, déjà préparer le hook)

## Critère d'acceptation

- Les keyframes ajoutés en phase 3 apparaissent comme des traits sur la waveform.
- Cliquer sur un trait sélectionne le keyframe (visible dans la scène 3D + inspecteur).
- L'inspecteur permet de modifier `time`, `position`, `curve`, `label` et de voir la mise à jour en temps réel dans la scène et la waveform.
- Shift+clic sur la waveform ajoute un keyframe au bon temps.
- Espace lance/met en pause la lecture.

## Commit

```
feat(phase-4): timeline avec marqueurs keyframes et inspecteur
```
