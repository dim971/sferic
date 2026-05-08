# Phase 10 — Analyse audio et monitoring temps réel

## Objectif

Ajouter trois choses :

1. **Analyse audio à l'ouverture du fichier** : détection de BPM et de tonalité (key/mode), affichées en transport bar.
2. **Affichage Bar/Beat** synchronisé à la lecture (`BAR 21.3.1`).
3. **Monitoring temps réel** : indicateur CPU, taille de buffer audio, vu-mètres L/R en peak.

## Partie 1 — Détection de BPM

### Installation

```bash
pnpm add web-audio-beat-detector
```

Cette bibliothèque (~5 KB) prend un `AudioBuffer` et retourne un BPM estimé. Elle utilise un détecteur de pics énergétiques sur la bande basse, raisonnablement précis pour de la musique populaire.

### Utilisation

Dans `src/lib/audio-analysis.ts` :

```ts
import { analyze } from 'web-audio-beat-detector';

export async function detectBpm(buffer: AudioBuffer): Promise<number | null> {
  try {
    const tempo = await analyze(buffer);
    return Math.round(tempo);
  } catch {
    return null;
  }
}
```

Appel : dans le store, après `loadAudioFile`, lance la détection en tâche de fond et patche `project.audioMeta.bpm` quand elle revient. Ne bloque pas l'UI.

```ts
loadAudioFile: async (path, arrayBuffer) => {
  // … décodage existant
  detectBpm(buffer).then(bpm => {
    if (bpm !== null) get().setAudioMeta({ bpm });
  });
}
```

### Édition manuelle

Si la détection se trompe, l'utilisateur peut éditer le BPM dans la transport bar via un petit champ cliquable (input number qui apparaît au clic). Persiste cette valeur en priorité par rapport à la détection.

## Partie 2 — Détection de tonalité (optionnelle / différable)

La détection de key (G♯ min, etc.) est plus complexe. Deux options :

### Option A — `essentia.js` (qualité pro, ~3 MB)

```bash
pnpm add essentia.js
```

```ts
import { Essentia, EssentiaWASM } from 'essentia.js';

let essentia: Essentia | null = null;

export async function detectKey(buffer: AudioBuffer): Promise<string | null> {
  if (!essentia) essentia = new Essentia(EssentiaWASM);
  // Mix mono pour Essentia
  const mono = mixToMono(buffer);
  const vec = essentia.arrayToVector(mono);
  const result = essentia.KeyExtractor(vec);
  return `${result.key} ${result.scale}`;  // e.g., "G# minor"
}
```

L'inconvénient : 3 MB ajoutés au bundle, et la première initialisation prend ~1 s.

### Option B — Différer

Si tu veux livrer plus vite, **affiche `—`** à la place de la tonalité et marque cette feature comme « v1.5 ». Le data model `audioMeta.key` reste prévu pour ne pas casser la migration plus tard.

**Recommandation** : option B au début, option A en fin de phase 10 si le temps le permet.

## Partie 3 — Affichage Bar/Beat

Une fois le BPM connu, on peut calculer la position en bars/beats. On suppose 4/4 et 16 sixteenths par bar par défaut.

```ts
export function timeToBarBeat(timeSec: number, bpm: number): {
  bar: number; beat: number; sixteenth: number;
} {
  const secPerBeat = 60 / bpm;
  const totalBeats = timeSec / secPerBeat;
  const bar = Math.floor(totalBeats / 4) + 1;
  const beat = Math.floor(totalBeats % 4) + 1;
  const sixteenth = Math.floor((totalBeats * 4) % 4) + 1;
  return { bar, beat, sixteenth };
}
```

Affichage dans la transport bar : `BAR 21.3.1` (quand `bpm !== null`, sinon ne pas afficher cette section).

## Partie 4 — Monitoring CPU

### Approche pragmatique

Le « CPU 14.2% » du screenshot représente la charge **du moteur audio**, pas du process global. On l'estime via le temps passé dans le callback de l'AudioContext rapporté à la durée disponible :

```ts
class CpuMeter {
  private samples: number[] = [];
  private lastTime = performance.now();
  private worklet: AudioWorkletNode | null = null;

  // Approche sans worklet : estimer via render quantum (128 samples)
  // À 48kHz : quantum dure 128/48000 = 2.67 ms
  // Si on mesure le temps entre deux frames d'animation et qu'on suppose
  // que l'audio rendering prend une fraction X, on peut publier X.
  // C'est une approximation, mais suffisante pour l'affichage indicatif.

  measure(): number {
    // Implémentation minimale : utiliser AudioContext.baseLatency comme proxy
    // ou effectivement intégrer un AudioWorkletProcessor qui mesure son propre temps
    return this.fakeUntilImplemented();
  }
}
```

**Implémentation propre** : ajouter un `AudioWorkletProcessor` dummy qui mesure son temps via `currentTime` interne, et émet ce taux via `port.postMessage`. Faisable mais 100 lignes de code supplémentaires.

**Implémentation MVP** : utiliser une heuristique :

```ts
const cpuPercent = Math.min(99,
  (audioContext.currentTime - audioContext.outputLatency) / audioContext.currentTime * 100 * 0.15
);
```

Pas exact mais fonctionnel pour donner un retour visuel. Documente-le en commentaire et marque comme « approximation ».

**Rafraîchissement** : 4 fois par seconde (`setInterval(250)`), pas plus.

## Partie 5 — Buffer size

Lecture directe :

```ts
const bufferSize = Math.round(audioContext.outputLatency * audioContext.sampleRate);
// ou audioContext.baseLatency * sampleRate selon ce que le navigateur expose
```

Affichage : `BUF 256` (en samples). Si la valeur n'est pas dispo (vieux navigateurs), masquer.

## Partie 6 — Vu-mètres L/R

### Implémentation

Ajoute un `AnalyserNode` après `audioContext.destination`… non, après `destination` n'est pas connectable. Il faut **dupliquer le signal** : ajouter un `ChannelSplitterNode` avant la destination, qui alimente :
1. `audioContext.destination` (sortie casque)
2. Un `ChannelSplitterNode` → 2 `AnalyserNode` (L et R)

Modifie le graphe en phase 9 pour ajouter cette dérivation à la fin :

```
… → mixOutput
        │
        ├──→ AnalyserNode (gauche)
        ├──→ AnalyserNode (droite)
        └──→ destination
```

Concrètement avec un splitter :

```ts
const splitter = ctx.createChannelSplitter(2);
const analyserL = ctx.createAnalyser();
const analyserR = ctx.createAnalyser();
analyserL.fftSize = 256;
analyserR.fftSize = 256;

mixOutput.connect(splitter);
splitter.connect(analyserL, 0);
splitter.connect(analyserR, 1);
mixOutput.connect(ctx.destination);
```

### Lecture des niveaux

Boucle `requestAnimationFrame` qui lit chaque analyser :

```ts
function readPeak(analyser: AnalyserNode): number {
  const arr = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(arr);
  let peak = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = Math.abs(arr[i]);
    if (v > peak) peak = v;
  }
  return peak;
}
```

Convertit en dB pour l'affichage :

```ts
const db = peak === 0 ? -Infinity : 20 * Math.log10(peak);
// Range affiché : -60 dB → 0 dB
```

### Composant `<MeterBar>`

Crée `src/components/transport/MeterBar.tsx` qui prend `peakDb` en prop et rend une barre horizontale segmentée (style screenshot : ~12 segments LED, vert sous -6 dB, jaune entre -6 et -3, rouge au-dessus). Utilise un état lissé (attack rapide, release plus lent) pour éviter le scintillement.

Lissage typique :

```ts
const smoothed = useRef(-60);
useEffect(() => {
  const loop = () => {
    const target = readPeak(analyser);
    const targetDb = target === 0 ? -60 : 20 * Math.log10(target);
    if (targetDb > smoothed.current) {
      smoothed.current = targetDb; // attack instantané
    } else {
      smoothed.current = Math.max(targetDb, smoothed.current - 1.5); // release ~ 90 dB/s
    }
    setDisplayDb(smoothed.current);
    raf = requestAnimationFrame(loop);
  };
  // …
});
```

### Placement UI

Topbar à droite : `CPU 14.2%  BUF 256  L [▮▮▮▮▮▯▯▯▯▯▯]  R [▮▮▮▮▮▮▯▯▯▯▯]` avec le composant `<MeterBar>` en deux instances.

## Partie 7 — Mode monitoring

Toggle dans la transport bar : `BINAURAL · monitoring` ↔ `STEREO · bypass`.

- En mode `BINAURAL` : tout passe par le panner HRTF (par défaut).
- En mode `STEREO` : on bypasse le panner et on envoie l'audio source directement à un `StereoPannerNode` neutre. Utile pour comparer A/B.

Implémentation : dans `AudioEngine`, deux chemins parallèles avec des gains qu'on bascule (un à 0, l'autre à 1). Crossfade rapide de 50 ms pour éviter les clics.

## Critère d'acceptation

- Ouvrir un fichier audio → 1-2 s plus tard, le BPM apparaît dans la transport bar.
- Pendant la lecture, l'affichage `BAR x.y.z` avance de manière cohérente avec le BPM.
- Cliquer sur le BPM permet de l'éditer manuellement.
- Les vu-mètres bougent en temps réel pendant la lecture, restent à -∞ en pause.
- Le toggle BINAURAL / STEREO fait clairement entendre la différence (en BINAURAL le son tourne, en STEREO il est centré sans spatialisation).
- L'affichage CPU / BUF se met à jour environ 4 fois par seconde.
- Aucune régression sur les phases précédentes.

## Notes pour l'agent

- Pour la détection de tonalité, **commence par l'option B** (différer). Si tu finis tôt, intègre essentia.js.
- L'estimation CPU n'a pas besoin d'être parfaite. Documente clairement que c'est une approximation.
- Les vu-mètres LED segmentés peuvent être faits en pure CSS (12 `<div>` avec largeurs fixes) — pas besoin de SVG ni Canvas.
- Si tu utilises essentia.js, son chargement WASM peut casser le bundle Vite. Configure `optimizeDeps.exclude` si besoin.

## Commit

```
feat(phase-10): détection BPM, vu-mètres L/R et monitoring temps réel
```
