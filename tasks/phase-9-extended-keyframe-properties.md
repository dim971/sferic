# Phase 9 — Propriétés étendues des keyframes

## Objectif

Étendre le modèle de données et le moteur audio pour supporter, **par keyframe** :
- Gain en dB
- Filtre passe-bas (LPF)
- Filtre passe-haut (HPF)
- Doppler on/off
- Air absorption (rolloff hautes fréquences avec la distance)
- Reverb send (envoi vers la réverb globale)
- Tension (paramètre de la courbe `cubic`)

Et ajouter le type de courbe **`cubic`** (interpolation Catmull-Rom paramétrée par tension) en plus de `hold`, `linear`, `ease-out`. Renommer aussi les courbes existantes pour matcher la nomenclature du design.

Ces automations sont **sample-accurate** car programmées via les `AudioParam` du Web Audio API.

## Migration du modèle de données

### Nouveau type keyframe

Remplace `SpatialKeyframe` dans `src/types/project.ts` :

```ts
export type CurveType = 'hold' | 'linear' | 'ease-out' | 'cubic';

export interface SpatialKeyframe {
  id: string;
  time: number;
  position: { x: number; y: number; z: number };
  curve: CurveType;
  tension: number;        // 0..1, utile uniquement si curve === 'cubic'
  gain: number;           // dB, [-60, +12], défaut 0
  lpf: number | null;     // Hz [200, 22000], null = bypass
  hpf: number | null;     // Hz [20, 2000], null = bypass
  doppler: boolean;       // défaut true
  airAbsorption: number;  // [0, 1], défaut 0.18
  reverbSend: number | null; // [0, 1], null = utiliser le global
  label?: string;
}
```

### Nouveau type Project

```ts
export interface Project {
  version: 2;             // était 1
  audioFile: AudioFileMeta;
  keyframes: SpatialKeyframe[];
  settings: ProjectSettings;
  audioMeta: { bpm: number | null; key: string | null }; // rempli par phase 10
  meta: { createdAt: string; updatedAt: string; name: string };
}
```

### Migration v1 → v2

Crée `src/lib/migrate.ts` :

```ts
export function migrateProject(raw: unknown): Project {
  const obj = raw as { version?: number };
  if (obj.version === 2) return raw as Project;
  if (obj.version === 1) {
    const v1 = raw as ProjectV1;
    return {
      ...v1,
      version: 2,
      audioMeta: { bpm: null, key: null },
      keyframes: v1.keyframes.map(kf => ({
        ...kf,
        curve: mapCurveV1(kf.curve),
        tension: 0.5,
        gain: 0,
        lpf: null,
        hpf: null,
        doppler: true,
        airAbsorption: 0.18,
        reverbSend: null,
      })),
    };
  }
  throw new Error(`Unknown project version: ${obj.version}`);
}

function mapCurveV1(c: string): CurveType {
  if (c === 'step') return 'hold';
  if (c === 'easeIn' || c === 'easeOut' || c === 'easeInOut') return 'ease-out';
  return 'linear';
}
```

Importer `migrateProject` dans `loadProject` (phase 7).

## Nouveau graphe audio

Remplace le graphe créé dans `AudioEngine.play()` par :

```
AudioBufferSourceNode
        │
        ▼
   GainNode (master, contrôlé par le slider de volume)
        │
        ▼
   GainNode (per-keyframe gain, automaté en dB → linéaire)
        │
        ▼
   BiquadFilterNode (HPF, type='highpass', frequency automaté ; bypass si null = freq=0)
        │
        ▼
   BiquadFilterNode (LPF, type='lowpass',  frequency automaté ; bypass si null = freq=22050)
        │
        ▼
   BiquadFilterNode (air absorption, type='lowpass', frequency = f(distance, airAbsorption))
        │
        ▼
   PannerNode (HRTF, position automatée — phase 5)
        │
        ├──────────────┐
        ▼              ▼
   GainNode        ConvolverNode (réverb)
   (dry, fixe)         │
        │              ▼
        │         GainNode (wet, automaté par reverbSend)
        │              │
        └──────┬───────┘
               ▼
       AudioContext.destination
```

### Implémentation `AudioEngine`

Étends la classe avec des champs et méthodes :

```ts
private gainKf: GainNode | null = null;
private hpf: BiquadFilterNode | null = null;
private lpf: BiquadFilterNode | null = null;
private airLpf: BiquadFilterNode | null = null;
private dry: GainNode | null = null;
private convolver: ConvolverNode | null = null;
private wet: GainNode | null = null;

applyKeyframeAutomation(keyframes, startOffsetSec) {
  // ... étendu : programmer pour chaque keyframe
  //   - gainKf.gain (en linéaire = 10 ** (dB / 20))
  //   - hpf.frequency (0 si null)
  //   - lpf.frequency (22050 si null)
  //   - airLpf.frequency (calculée selon distance et airAbsorption)
  //   - panner.positionX/Y/Z (déjà fait phase 5)
  //   - wet.gain (override per-keyframe ou global selon reverbSend)
}
```

### Calcul de l'air absorption

Approximation simple : la fréquence de coupure du LPF d'absorption décroît avec la distance et avec le facteur d'absorption :

```ts
function airAbsorptionCutoff(distance: number, airAbs: number): number {
  // distance ~ [0, 2], airAbs ~ [0, 1]
  // À distance 0 : cutoff = 22050 Hz (transparent)
  // À distance 2 et airAbs=1 : cutoff ~ 2000 Hz (très assourdi)
  const k = airAbs * Math.min(distance, 2);
  return 22050 * Math.exp(-k * 1.2);
}
```

Programmation de `airLpf.frequency` à chaque keyframe avec la fonction ci-dessus, en utilisant la position du keyframe pour calculer sa distance au listener (rayon `√(x²+y²+z²)`).

### Doppler — implémentation pragmatique

Le `PannerNode` Web Audio **n'a plus** de gestion Doppler intégrée (retirée de la spec). Pour cette phase, implémente uniquement le **toggle dans l'UI et le data model**, mais **ne fais pas de pitch shifting réel** côté audio. Documente clairement le statut « stub » dans un commentaire dans le code :

```ts
// TODO: Doppler effect — Web Audio API ne fournit plus l'automation native.
// Implémentation manuelle possible via DelayNode modulé ou playbackRate du source,
// mais coût en complexité non justifié pour la v1. Stub pour l'instant.
```

L'utilisateur verra le toggle dans l'UI et il sera persisté dans le projet ; seul le rendu réel est différé. À itérer plus tard.

### Courbe `cubic` avec tension

Pour les automations audio, le Web Audio API propose `setValueCurveAtTime(curveArray, time, duration)` qui permet de programmer un tableau de valeurs. On l'utilise pour les courbes cubic :

```ts
function buildCubicCurve(from: number, to: number, tension: number, samples = 64): Float32Array {
  // Catmull-Rom-like avec tension : t' = lerp avec un easing paramétré
  const arr = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    // Hermite avec tangentes scalées par tension
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 =  2*t3 - 3*t2 + 1;
    const h10 =      t3 - 2*t2 + t;
    const h01 = -2*t3 + 3*t2;
    const h11 =      t3 -   t2;
    const m0 = (to - from) * (1 - tension);
    const m1 = (to - from) * (1 - tension);
    arr[i] = h00 * from + h10 * m0 + h01 * to + h11 * m1;
  }
  return arr;
}

// puis lors de la programmation :
const dur = nextKf.time - kf.time;
audioParam.setValueCurveAtTime(buildCubicCurve(kf.value, nextKf.value, kf.tension), startTime, dur);
```

## UI — Inspector enrichi

Étends le composant `Inspector` ajouté en phase 4 avec les sections suivantes, dans cet ordre :

### Section `POSITION`

Toggle d'unité en haut à droite : `cartesian · m` ↔ `polar · ° / m`.

- Mode cartésien : sliders + input numériques X / Y / Z (range −2..+2 m, step 0.001)
- Mode polaire : Az (azimut) °, El (élévation) °, Dist (rayon) m
- Conversion polar ↔ cartesian dans `src/lib/math3d.ts` :
  ```ts
  // azimuth : angle horizontal depuis +X dans le plan X/Z, anti-horaire vu du dessus
  // elevation : angle vers le haut depuis le plan X/Z
  export function cartToSpherical(p): { az: number; el: number; r: number } { … }
  export function sphericalToCart(s): { x: number; y: number; z: number } { … }
  ```

### Section `MOTION`

- 4 boutons toggles (radio group) : `hold` / `linear` / `ease-out` / `cubic`
- Affichage `Duration : +N.000s → kfNN` (calcul dynamique : durée jusqu'au prochain keyframe par `time` croissant)
- Slider `Tension` (0..1, désactivé si curve ≠ cubic)

### Section `GAIN & FILTER`

- Champ numérique `Gain` (dB, range −60..+12, step 0.1)
- Champ numérique `LPF` (Hz, range 200..22000, step 100, valeur affichée en kHz si > 1000) avec toggle bypass
- Champ numérique `HPF` (Hz, range 20..2000, step 10) avec toggle bypass
- Toggle `Doppler` (on/off)

### Section `SEND`

- Champ pourcentage `Reverb` (0..100 %) avec un mini bouton « auto » qui le remet à null (utiliser global)
- Champ numérique `Air absorb` (0..1, step 0.01)

## Bouton « + KEYFRAME »

Dans la transport bar, ajoute un bouton orange CTA `+ KEYFRAME` qui :
1. Calcule la position interpolée actuelle (fonction `interpolatePosition` déjà existante)
2. Crée un keyframe avec cette position au temps courant
3. Hérite des paramètres audio (gain/lpf/hpf/etc.) du keyframe précédent dans le temps, ou des valeurs par défaut si premier
4. Sélectionne automatiquement le nouveau keyframe

## Reprogrammation à chaud

Si l'utilisateur modifie n'importe quel paramètre audio d'un keyframe pendant la lecture, il faut **immédiatement** reprogrammer les automations à partir du temps courant. Implémenter dans le store :

```ts
updateKeyframe: (id, partial) => {
  set(state => { /* update */ });
  if (get().playback.isPlaying) {
    AudioEngine.applyKeyframeAutomation(get().project!.keyframes, AudioEngine.getCurrentTime());
  }
}
```

## Critère d'acceptation

- Charger un audio, créer 3 keyframes avec gains différents (-12, 0, +6 dB) → on entend nettement la différence à la lecture.
- Mettre un LPF à 800 Hz sur un keyframe : la portion entre ce keyframe et le suivant doit sonner sourde, et redevenir claire après.
- Toggle Doppler n'a pas d'effet audio (stub) mais la valeur est conservée dans le projet sauvegardé/rechargé.
- Reverb send par keyframe : passer de 0 à 80 % entre deux keyframes fait monter la queue de réverb progressivement.
- Migration : ouvrir un projet v1 sauvegardé avant cette phase fonctionne (test en gardant un `.sferic.json` v1 sous le coude).
- Courbe cubic avec tension 0 = quasi-step, tension 1 = lisse.
- Inspecteur affiche correctement toutes les nouvelles sections.

## Commit

```
feat(phase-9): propriétés étendues des keyframes (gain, filtres, send, courbe cubic)
```
