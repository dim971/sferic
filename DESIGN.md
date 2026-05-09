# DESIGN — Système visuel de Sferic

> **Source de vérité visuelle** : `design/Screenshot 2026-05-09 at 08.53.47.png`
> Cette image définit le rendu cible. Toute divergence doit être justifiée et discutée.

L'application reprend les codes d'un DAW pro : **fond très sombre, accent orange dominant, typographie compacte, lectures numériques denses**. Tous les écrans vivent dans cette même grammaire.

---

## 1. Tokens de design

À déclarer dans `app/src/index.css` via la couche `@theme` de Tailwind 4 (`@theme { --color-...: ...; }`) ou en variables CSS pures.

### 1.1 Couleurs

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#07080A` | Fond global (zone autour des panneaux) |
| `--bg-panel` | `#0E0F13` | Fond des panneaux (scènes 3D, inspecteur, timeline) |
| `--bg-panel-elev` | `#15171C` | Sections internes de l'inspecteur, hover de boutons |
| `--bg-input` | `#1A1C22` | Champs numériques, sliders inactifs |
| `--border-subtle` | `#1F222A` | Séparateurs entre panneaux |
| `--border-strong` | `#2A2E38` | Bord des champs et boutons inactifs |
| `--text-primary` | `#E8E8EA` | Valeurs, titres |
| `--text-secondary` | `#9CA0AB` | Labels, menus de la barre du haut |
| `--text-dim` | `#5A5F6B` | Texte désactivé, units, hint |
| `--accent` | `#F87328` | Couleur d'accent principale (orange Sferic) |
| `--accent-hot` | `#FF8A3D` | Hover/active sur l'accent |
| `--accent-soft` | `#3A1E12` | Fond des chips orange (UNSAVED, sélection) |
| `--listener` | `#4F8EF7` | Le point bleu de l'auditeur (et seul usage du bleu) |
| `--vu-green` | `#22A858` | LEDs des VU mètres (zone safe) |
| `--vu-yellow` | `#E0B341` | LEDs des VU mètres (zone warn) |
| `--vu-red` | `#E0533C` | LEDs des VU mètres (zone clip) |
| `--waveform` | `#F87328` | Forme d'onde (= accent) |
| `--waveform-bg` | `#1A0E08` | Fond du conteneur de la waveform |

### 1.2 Typographie

- **Famille principale** : `Inter`, fallback `system-ui, -apple-system, sans-serif`. À charger via `@fontsource/inter` ou Google Fonts (au choix de la phase 3).
- **Famille numérique** : `JetBrains Mono`, fallback `ui-monospace, monospace`. Utilisée pour **tous les readouts numériques** (coordonnées, temps, dB, Hz). Les chiffres doivent être tabulaires (`font-variant-numeric: tabular-nums;`).
- **Tailles** :
  - `text-[10px]` — labels de sections (`POSITION`, `MOTION`, `GAIN & FADES`, `DOPP`), avec `tracking-widest uppercase text-[--text-dim]`.
  - `text-[11px]` — labels de champs (X, Y, Z, Az, El, R, Vol, HPF…), `text-[--text-secondary]`.
  - `text-[12px]` — valeurs numériques, menus de la barre du haut.
  - `text-[13px]` — titres de keyframe (`Keyframe 05`).
  - `text-[14px]` — boutons principaux (Save, Open, Render).
  - `text-[16px]` — logo `Sferic`.

### 1.3 Espacement / rayons / ombres

- Rayons : `rounded-md` (4px) partout. Pas d'arrondis prononcés.
- Espacements internes : `px-2 py-1.5` pour les champs, `p-3` pour les sections d'inspecteur, `gap-2` entre champs d'une même ligne.
- Ombres : aucune. Le contraste vient uniquement des fonds et des `--border-*`.

---

## 2. Layout global

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Topbar (h ≈ 44px)                                                       │
├──────────────────────────────────────┬───────────────────────────────────┤
│  SceneTop      │  ScenePerspective   │                                   │
│  (1fr)         │  (1fr)              │   Inspector (320px)               │
│                │                     │                                   │
├──────────────────────────────────────┴───────────────────────────────────┤
│  Timeline (transport + waveform + ruler)  (h ≈ 180px, redim. 140-260)    │
└──────────────────────────────────────────────────────────────────────────┘
```

Tailwind : `grid grid-rows-[44px_1fr_180px] grid-cols-[1fr_320px]`. La rangée 2 contient à gauche la `<DualScene />` (qui se subdivise 50/50 en interne) et à droite l'`<Inspector />`. La rangée 3 (Timeline) traverse les deux colonnes.

---

## 3. Topbar

Une seule ligne, alignée verticalement au centre, fond `--bg-base`, séparée de la zone principale par `border-b border-[--border-subtle]`.

**De gauche à droite** :

1. **Logo** : pastille orange pleine 8px + texte `Sferic` en `text-[16px]` blanc, `font-medium`.
2. **Menus** : `File / Edit / Project / Render / View / Help` en `text-[--text-secondary] text-[12px]`, gap `gap-3`. Hover → `text-[--text-primary]`. Cliquer ouvre un menu natif (phase 7+).
3. **Métadonnées du fichier source** (au centre) : `<source-name>` en `--accent`, puis sample rate (`44.1k`), puis nom du fichier audio chargé en `text-[--text-secondary]`.
4. **Indicateur de save** : chip `UNSAVED` (fond `--accent-soft`, texte `--accent`, `text-[10px] tracking-widest uppercase`, `px-2 py-0.5 rounded-md`). N'apparaît que si `isDirty === true`.
5. **Save / Open** : boutons outline orange (`border border-[--accent] text-[--accent] hover:bg-[--accent-soft]`, `text-[14px] px-3 py-1 rounded-md`).
6. **VU mètres** : deux barres verticales (L/R), 14 segments chacune. Couleurs : 10 segments verts, 3 jaunes, 1 rouge, allumées/éteintes selon le niveau. Hauteur ≈ 28px. Animation par requestAnimationFrame depuis l'`AnalyserNode` du moteur audio (phase 5).
7. **Render** : bouton CTA plein orange (`bg-[--accent] hover:bg-[--accent-hot] text-white font-medium text-[14px] px-4 py-1.5 rounded-md`). Ouvre le modal d'export (phase 6).

---

## 4. Scènes 3D — `DualScene`

**Deux canvases R3F côte à côte**, séparés par une ligne `--border-subtle` 1px.

| Panneau | Caméra | But |
|---|---|---|
| `SceneTop` | `OrthographicCamera` au-dessus, regard vers -Y | Vue plongeante (placement précis dans le plan horizontal) |
| `ScenePerspective` | `PerspectiveCamera` libre, `OrbitControls` actifs | Vue 3D avec rotation, sentiment d'espace |

Les deux scènes partagent **le même état** (mêmes keyframes, même playhead). Sélectionner un keyframe dans l'une le sélectionne dans l'autre.

### 4.1 Contenu visuel commun

- **Sphère wireframe** rayon 1, `meshBasicMaterial({ color: '#F87328', wireframe: true, transparent: true, opacity: 0.18 })`. Subdivision modérée (segments=20,16) — elle doit lire comme une grille, pas un solide.
- **Auditeur** : petite sphère pleine `--listener` rayon 0.04 à l'origine. Pas de cône directionnel (l'auditeur est fixe).
- **Trajectoire** : ligne orange (`--accent`, opacité 0.6, épaisseur 2) qui relie les positions interpolées de la première à la dernière keyframe (échantillonnée à ~64 segments). Visible uniquement si ≥ 2 keyframes.
- **Marqueurs de keyframes** : sphère pleine `--accent` rayon 0.05, contour 1px `--accent-hot`. Numérotation flottante (HTML overlay via `<Html>` de drei) en `text-[10px]` blanc.
- **Keyframe sélectionné** : rayon 0.08, halo (sprite circulaire 0.18 transparent `--accent`), label étendu (`Keyframe NN` + temps).
- **Source courante** (position interpolée au temps de lecture) : sphère pleine `--accent` rayon 0.06 avec halo plus fort, distincte des marqueurs par sa taille et son halo.

### 4.2 Overlays HTML par scène

- Coin haut-gauche : label de vue (`TOP` / `PERSPECTIVE`) en `text-[10px] tracking-widest uppercase --text-dim`.
- Coin haut-droit : timecode courant en mono (`text-[--text-secondary] text-[12px]`).
- Coins bas : repères d'axes (`+1.0` / `-1.0`) sur `SceneTop`, lecture d'angles (azimut, élévation) sur `ScenePerspective`.

### 4.3 Interactions

- **Clic dans le vide** sur `ScenePerspective` (rayon de la sphère unité) → `addKeyframe(positionProjetée, currentTime)`. La projection respecte `settings.snapToSphere` (par défaut true → la position est normalisée à r=1).
- **Clic sur un marqueur** → `selectKeyframe(id)`.
- **Drag** d'un marqueur sélectionné → `updateKeyframe(id, { position })` en temps réel.
- `OrbitControls` actif sur `ScenePerspective` uniquement (la vue Top reste fixe).

---

## 5. Inspector (panneau droit, 320px)

Conteneur : `bg-[--bg-panel] border-l border-[--border-subtle] overflow-y-auto p-3`. Si aucun keyframe sélectionné, on affiche les **réglages projet** (panningModel, distanceModel, refDistance, rolloffFactor, reverb).

Quand un keyframe est sélectionné :

### 5.1 En-tête

```
INSPECTOR                                            (label section)
─────
[icon] Keyframe 05                          [< 1 of 7 >]
00:11.150
```

- Icône keyframe : petit losange orange 10px.
- Pagination : flèches gauche/droite cyclant entre keyframes triés par temps.

### 5.2 Section `POSITION`

Deux sous-blocs alignés en colonne :

**Cartésien** (3 lignes) :
```
X    [-0.420]
Y    [-0.180]
Z    [ 0.00 ]
```
Chaque champ : input numérique mono, fond `--bg-input`, `text-[12px]`, focus orange. Drag horizontal sur le label pour scrubber (geste DAW classique, optionnel v1).

**Sphérique (lecture seule v1)** :
```
Az   +45.0°
El   +27.0°
R    0.92
```
Calculées depuis (X,Y,Z). En `--text-secondary text-[12px]`. Servent de readout, pas d'input dans v1.

### 5.3 Section `MOTION`

**Curve picker** : 4 chips horizontaux côte à côte, `flex gap-1`, label en haut (`CURVE`). Valeurs : `Linear`, `Eaze` (= easeInOut), `Smooth` (= setTargetAtTime adouci), `Step`. Chip actif = fond `--accent-soft`, bordure `--accent`, texte `--accent`. Inactif = bordure `--border-strong`, texte `--text-secondary`.

> **Note v1** : `Eaze` mappe sur `easeInOut` interne, `Smooth` mappe sur `setTargetAtTime` avec tau adapté. Garder ces 4 noms exacts dans l'UI même si le moteur audio en gère seulement 2-3 distincts en interne.

**Duration** : champ numérique + slider (`+0.000s`). Définit la durée de la transition vers ce keyframe depuis le précédent (`0` = instantané, default = écart de temps avec keyframe précédent).

**Tension** : champ numérique 0..1 (`0.42`). N'agit que sur curves `Smooth` (modifie le tau du `setTargetAtTime`).

### 5.4 Section `GAIN & FADES`

```
Vol    [-2.5]  dB
HPF    [10.0]  Hz
LPF    [40]    Hz       (slider/numérique)
Snapper [●○]  (toggle)
```

- `Vol` : gain par-keyframe en dB, range `-24..+6`. Phase 5 le branche sur un `GainNode` automatisé.
- `HPF` / `LPF` : fréquences de coupe. Phase 5 (ou phase polish) branche sur deux `BiquadFilterNode`.
- `Snapper` : toggle "snap-to-sphere" pour ce keyframe (forcer `r=1` même si l'utilisateur a posé le point ailleurs). Stocke un flag `snap` dans le keyframe.

> **Note v1 strict** : `HPF`, `LPF` et `Snapper` peuvent rester des **stubs UI** (les valeurs sont stockées dans le keyframe mais le moteur audio les ignore en v1). Marqués comme tels dans l'inspecteur via une icône d'astérisque ou un tooltip "v1: read-only". Le `Vol` (`gainDb`) doit être fonctionnel dès phase 5.

### 5.5 Section `DOPP` (Doppler)

```
Speed     [32]  Vs
Doppler   [○]
Velocity  [●]
   0.75   (intensité)
```

- `Speed` : vitesse simulée du déplacement en m/s (lecture seule, calculée depuis les keyframes adjacents).
- `Doppler` toggle : active le shift de fréquence selon vitesse radiale (v1 strict : stub).
- `Velocity` toggle : active la modulation de gain selon vitesse tangentielle (v1 strict : stub).
- Valeur 0..1 : intensité globale de l'effet doppler/velocity.

> **Note v1 strict** : toute la section `DOPP` peut rester en stub UI. Stocker les valeurs dans le keyframe, ne pas brancher au moteur audio en v1. Phase ultérieure (post-roadmap actuel).

### 5.6 Toggle styling

Toggle générique : pastille `12px`, fond `--bg-input` quand off, `--accent` quand on, transition 120ms. Label à gauche en `--text-secondary`.

---

## 6. Timeline (rangée du bas)

Conteneur full width (traverse les deux colonnes), `bg-[--bg-panel] border-t border-[--border-subtle]`.

Grille interne : `grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2`.

### 6.1 Bloc gauche — transport + readouts

```
[⏵] [⏸] [⏹]    1:23
+1.0  +1.0  +0  +0   0
```
- 3 boutons (play/pause/stop), icônes orange pleines 16px sur fond transparent. État actif = fond `--accent-soft`.
- Time display mono, `text-[14px]`, `--text-primary`.
- Une grille 5 colonnes de readouts en mono (`text-[10px] --text-dim`) : x, y, z, az, el de la source courante.

### 6.2 Bloc central — waveform

- `wavesurfer.js` v7 :
  - `waveColor: '#F87328'`
  - `progressColor: '#FF8A3D'`
  - `cursorColor: '#FFFFFF'`
  - `cursorWidth: 1`
  - `barWidth: 1`, `barGap: 1`, `barRadius: 0`
  - `height: 96`
  - `backgroundColor: '#1A0E08'` (assigné via CSS sur le conteneur)
- **Marqueurs de keyframes** : trait vertical 2px sur toute la hauteur de la waveform à `(kf.time / duration) * 100%`, couleur `--accent` opacité 0.5. Sélectionné → opacité 1, petit losange orange 6px en haut, bouton X au hover. Cliquable → `selectKeyframe`. Shift+clic sur la waveform → `addKeyframe(positionInterpolée, time)`.

### 6.3 Bloc droit — controls de zoom

- Boutons `±` pour zoom timeline.
- Lecture compacte de la sélection courante (`+87/+100`) en mono `--text-dim`.

### 6.4 Ruler des temps (sous la waveform)

Bande de 16px, `bg-transparent border-t border-[--border-subtle]`. Graduations à 0:00, 0:30, 1:00, etc. en mono `text-[10px] --text-dim`. Le tick correspondant à un keyframe sélectionné passe en `--accent`.

---

## 7. Iconographie

- **Source unique** : `lucide-react` (déjà léger, MIT). À ajouter en phase 1 : `pnpm add lucide-react`.
- Toutes les icônes : 16px, stroke 1.5px, couleur héritée de `currentColor`. Pas de remplissage sauf transport (play/pause/stop pleins).
- Icônes attendues : `Play`, `Pause`, `Square` (stop), `FolderOpen`, `Save`, `Download` (export/render), `Plus`, `Trash2`, `ChevronLeft`, `ChevronRight`, `Diamond` (keyframe).

---

## 8. États interactifs

| État | Effet |
|---|---|
| Hover bouton outline | `bg-[--accent-soft]` |
| Hover bouton plein | `bg-[--accent-hot]` |
| Focus input | bordure `--accent` 1px, pas d'outline système |
| Drag en cours sur scrubber | curseur `cursor-ew-resize`, halo `--accent` opacité 0.3 |
| Disabled | opacity 0.4, `cursor-not-allowed`, pas de hover |
| Keyframe sélectionné | halo orange + bordure `--accent` partout (3D, timeline, inspecteur) |

---

## 9. Stubs v1 vs fonctionnel

Pour rester aligné avec le ROADMAP existant **sans bloquer le visuel 1:1**, certains champs de l'inspecteur stockent leur valeur dans le modèle de données mais **n'agissent pas encore** sur le moteur audio en v1. Récap :

| Contrôle | v1 | Phase qui le câblera |
|---|---|---|
| Position X/Y/Z | ✅ fonctionnel | 3 |
| Az/El/R readout | ✅ fonctionnel (calcul) | 4 |
| Curve (Linear/Eaze/Smooth/Step) | ✅ fonctionnel | 5 |
| Duration / Tension | ✅ fonctionnel | 5 |
| Vol (`gainDb`) | ✅ fonctionnel | 5 |
| Snapper (`snap`) | ✅ fonctionnel (placement) | 3 |
| HPF / LPF | ⚠️ stub UI | post-v1 (à proposer après phase 8) |
| Doppler / Velocity / Speed | ⚠️ stub UI | post-v1 |
| VU mètres | ✅ fonctionnel | 5 |

Marquer les stubs avec une petite mention `· stub` en `--text-dim` dans le label, ou un astérisque `*` à côté de la valeur, pour la transparence côté utilisateur.

---

## 10. Référence visuelle

L'image `design/Screenshot 2026-05-09 at 08.53.47.png` doit servir de **carte au trésor** : à chaque phase qui touche à l'UI, l'agent ouvre cette image et compare le rendu local pixel à pixel (proportions, couleurs, hiérarchie). Tout écart visible doit être corrigé avant le commit de phase, ou explicitement noté dans le récapitulatif de phase.

Ordre de priorité quand il faut trancher :
1. **Le screenshot** (si visuellement cassant).
2. **DESIGN.md** (ce fichier — pour les détails non visibles dans le screenshot).
3. `ARCHITECTURE.md` (pour les contraintes techniques).
4. Goût personnel de l'agent (jamais).
