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

3. **Créer `src/components/inspector/Inspector.tsx`** en suivant **strictement** `DESIGN.md §5`. Le panneau (320px droite, `bg-[--bg-panel]`) a deux modes :

   - **Aucun keyframe sélectionné** → afficher les **réglages projet** dans une section unique `PROJECT` :
     - Toggle `panningModel` (HRTF / equalpower).
     - Slider `refDistance` (0..10), `rolloffFactor` (0..2).
     - Toggle `reverb.enabled` + slider `reverb.wet` (0..1).
     - Toggle `snapToSphere` (default true).

   - **Keyframe sélectionné** → afficher l'en-tête + 4 sections (`POSITION`, `MOTION`, `GAIN & FADES`, `DOPP`). Voir `DESIGN.md §5.1–5.5` pour la mise en page précise. Récap :

     **En-tête** :
     - Tab `INSPECTOR` (label section).
     - Ligne : icône losange `--accent` 10px, `Keyframe NN`, paginator `< 1 of N >` à droite (cyclique entre keyframes triés par temps).
     - Ligne : timecode mono `00:11.150`.

     **Section `POSITION`** :
     - 3 inputs cartésiens (X, Y, Z) en mono, fond `--bg-input`. Update temps réel sur change.
     - 3 readouts sphériques (Az, El, R) calculés depuis (X,Y,Z) — lecture seule v1.

     **Section `MOTION`** :
     - **Curve picker** : 4 chips `Linear` / `Eaze` / `Smooth` / `Step` (cf. `DESIGN §5.3`). Chip actif = `bg-[--accent-soft] border-[--accent] text-[--accent]`.
     - Input `Duration` (s, default = écart avec keyframe précédent).
     - Input `Tension` (0..1, n'agit que si curve === 'smooth').

     **Section `GAIN & FADES`** :
     - `Vol` input dB (-24..+6).
     - `HPF` input Hz (stub UI v1 — marquer `*`).
     - `LPF` input Hz (stub UI v1 — marquer `*`).
     - Toggle `Snapper` (`snap` du keyframe).

     **Section `DOPP`** :
     - `Speed` (m/s, lecture seule, calculé depuis keyframes adjacents).
     - Toggle `Doppler` (stub v1).
     - Toggle `Velocity` (stub v1).
     - Slider `Intensity` 0..1 (stub v1).

   - **Bouton Supprimer** : icône `Trash2` rouge `--vu-red`, en bas du panneau, confirme via `dialog.ask`.

   Indiquer les contrôles stubs avec un astérisque `*` discret en `--text-dim` à côté du label, ou un tooltip "v1: read-only" (cf. `DESIGN §9`).

4. **Comportement de la waveform** :
   - **Clic simple** sur la waveform → seek.
   - **Shift + clic** → ajoute un keyframe à ce temps, à la position 3D courante de la source (ou à `(0,0,-1)` si aucun keyframe avant).
   - Indiquer ces raccourcis dans une légende discrète sous la timeline.

5. **Styliser les marqueurs de keyframes** sur la waveform (cf. `DESIGN §6.2`) :
   - Trait vertical 2px sur toute la hauteur, couleur `--accent` opacité 0.5.
   - Si sélectionné : opacité 1, petit losange orange 6px en haut, bouton `X` (icône `lucide-react/X`) au hover en haut → `removeKeyframe(id)`.

6. **Ruler des temps** sous la waveform (cf. `DESIGN §6.4`) : bande 16px avec graduations 0:00, 0:30, 1:00, etc. en mono `text-[10px] --text-dim`. Le tick correspondant à un keyframe sélectionné passe en `--accent`.

7. **Composer la `<Timeline />` finale** : la rangée du bas (180px) contient en grille `grid-cols-[auto_1fr_auto] gap-3 px-3 py-2` (cf. `DESIGN §6`) :
   - Bloc gauche : `<TransportBar />` (créé en phase 2) + grille 5 readouts mono (x, y, z, az, el de la source courante).
   - Bloc central : `<Waveform />` + ses marqueurs + ruler.
   - Bloc droit : boutons `± zoom` (icônes `Plus`/`Minus`), lecture compacte de la sélection.

8. **Ajouter raccourcis clavier** dans un hook `useKeyboardShortcuts()` :
   - `Espace` → play/pause
   - `Suppr` → supprimer le keyframe sélectionné
   - `Esc` → désélectionner
   - `Cmd/Ctrl+S` → save (pour la phase 7, déjà préparer le hook)

## Design

C'est la phase la plus dense visuellement. Comparer **section par section** au screenshot et à `DESIGN.md §5–6`. Pièges classiques :
- Les chips de Curve doivent être en ligne, compacts, et le sélectionné saute clairement (pas juste un texte gras).
- Les readouts sphériques (Az/El/R) sont en `--text-secondary` non éditables — les confondre avec des inputs casserait l'analogie avec le screenshot.
- Les stubs (HPF/LPF/Doppler/Velocity) doivent être **présents** dans l'UI, pas masqués — c'est ce qui rend le rendu fidèle à la cible. Les marquer comme stubs (astérisque + tooltip) est suffisant.
- La timeline a **trois blocs** alignés horizontalement (transport+readouts | waveform+ruler | zoom). Pas de retour à la ligne, ça doit tenir dans 180px de haut.

## Critère d'acceptation

- Les keyframes ajoutés en phase 3 apparaissent comme des traits orange sur la waveform.
- Cliquer sur un trait sélectionne le keyframe (visible dans les deux scènes 3D + inspecteur).
- L'inspecteur affiche les 4 sections (POSITION, MOTION, GAIN & FADES, DOPP) avec en-tête + paginator. Modifier les contrôles fonctionnels (X/Y/Z, Curve, Duration, Tension, Vol, Snapper) propage en temps réel.
- Les contrôles stubs (HPF/LPF/Doppler/Velocity) sont visibles, leurs valeurs sont stockées dans le keyframe, mais ne sont pas câblés à l'audio en v1.
- Shift+clic sur la waveform ajoute un keyframe au bon temps.
- Espace lance/met en pause la lecture.
- Comparer la disposition de l'inspecteur au screenshot : densité, alignement, casse des labels (`POSITION` en majuscules), tabular nums sur tous les readouts.

## Commit

```
feat(phase-4): timeline avec marqueurs keyframes et inspecteur
```
