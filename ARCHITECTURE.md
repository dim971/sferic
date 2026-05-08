# Architecture technique

> **Identité visuelle** : `DESIGN.md` est la source de vérité pour tout ce qui touche au rendu (couleurs, typographie, layout, composants). Cette architecture définit les contours techniques ; `DESIGN.md` définit l'apparence. En cas de conflit visuel/technique, voir `DESIGN.md §10` pour l'ordre de priorité.

## 1. Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri 2 (binaire natif)                  │
│  ┌──────────────────────┐    ┌───────────────────────────┐  │
│  │   Backend Rust       │    │   Frontend (WebView)      │  │
│  │   ─────────────      │◄──►│   ─────────────────       │  │
│  │   • Décodage audio   │ IPC│   • React + TypeScript    │  │
│  │     (symphonia)      │    │   • Web Audio API engine  │  │
│  │   • I/O fichiers     │    │   • Three.js scène 3D     │  │
│  │   • Encodage WAV     │    │   • WaveSurfer timeline   │  │
│  │   • Plugin fs/dialog │    │   • Zustand store         │  │
│  └──────────────────────┘    └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 2. Modèle de données

### `SpatialKeyframe`
```ts
type CurveType = 'linear' | 'eaze' | 'smooth' | 'step';
// 'eaze' = ease-in-out classique ; 'smooth' = setTargetAtTime adouci paramétré par `tension`.

interface SpatialKeyframe {
  id: string;           // uuid
  time: number;         // en secondes depuis le début du morceau
  position: {
    x: number;          // -1 (gauche) à 1 (droite)
    y: number;          // -1 (bas) à 1 (haut)
    z: number;          // -1 (avant) à 1 (arrière) ; rayon recommandé : 1
  };
  curve: CurveType;
  label?: string;

  // Motion (phase 5)
  duration?: number;    // s, override de l'écart avec le keyframe précédent (default = écart)
  tension?: number;     // 0..1, n'agit que si curve === 'smooth'

  // Gain & Fades (phase 5 pour gainDb ; HPF/LPF restent stubs UI v1, cf. DESIGN §9)
  gainDb?: number;      // -24..+6, default 0
  snap?: boolean;       // true = la position est forcée à r=1 (snap-to-sphere), default = settings.snapToSphere
  hpfHz?: number;       // 20..2000, stub v1
  lpfHz?: number;       // 200..20000, stub v1

  // Doppler (stubs v1)
  doppler?: boolean;        // active le shift de fréquence
  velocity?: boolean;       // active la modulation de gain par vitesse
  dopplerIntensity?: number; // 0..1
}
```

> Tous les champs au-delà de `id/time/position/curve/label` sont optionnels et stockés dans le projet sauvegardé. Voir `DESIGN.md §9` pour le statut « fonctionnel vs stub » en v1.

### `Project`
```ts
interface Project {
  version: 1;
  audioFile: {
    originalPath: string;     // chemin absolu d'origine
    embeddedSampleRate: number;
    durationSec: number;
    channels: number;
  };
  keyframes: SpatialKeyframe[];
  settings: {
    panningModel: 'HRTF' | 'equalpower';
    distanceModel: 'linear' | 'inverse' | 'exponential';
    refDistance: number;
    rolloffFactor: number;
    reverb: { enabled: boolean; wet: number };  // 0..1
    snapToSphere: boolean;                       // default true — colle les nouveaux keyframes à r=1
    doppler: { enabled: boolean; intensity: number }; // global, stub v1 (cf. DESIGN §9)
  };
  meta: { createdAt: string; updatedAt: string; name: string };
}
```

Format de sauvegarde : `.spatialize.json` (texte lisible, versionné).

## 3. Graphe audio (temps réel)

```
AudioBufferSourceNode
        │
        ▼
   GainNode (volume master)
        │
        ▼
   PannerNode (panningModel: 'HRTF')   ←── automation 3D depuis keyframes
        │            ▲
        │            │ AudioListener (fixe en 0,0,0)
        ▼
   ConvolverNode (réverb optionnelle)
        │
        ▼
   AudioContext.destination
```

L'automation des positions se fait via `pannerNode.positionX.setValueAtTime(...)` et `setTargetAtTime(...)` ou `linearRampToValueAtTime(...)` selon la courbe choisie pour chaque keyframe. **Cette automation native du Web Audio API est sample-accurate** — pas besoin d'un timer JS.

Le `GainNode` master est aussi automatisé par-keyframe (`gainDb` du keyframe → `gain.setTargetAtTime`). Les nœuds `BiquadFilterNode` HPF/LPF, ainsi que la modulation Doppler/Velocity, sont **prévus** dans le graphe mais **stubs en v1** : leurs valeurs sont stockées dans le keyframe mais ne sont pas câblées dans phase 5. Cf. `DESIGN.md §9`.

## 4. Rendu offline

Pour exporter, on duplique le graphe ci-dessus dans un `OfflineAudioContext` initialisé à la durée et au sample rate du fichier source. On reprogramme toutes les automations depuis `t=0`, on appelle `startRendering()` qui retourne un `AudioBuffer`, qu'on encode :

- **WAV** : sérialisation manuelle PCM 16-bit ou 24-bit (utilitaire dans `lib/wav-encoder.ts`)
- **MP3** : `@breezystack/lamejs` (LAME compilé en JS, fonctionne en main thread, OK pour <30 min)

Pour les très gros fichiers (>1h), on peut déléguer l'encodage WAV à Rust via un `tauri::command` qui reçoit le `AudioBuffer` sérialisé en `Float32Array` et utilise `hound`.

## 5. Composants React principaux

```
<App>
├── <Topbar />                       — logo, menus, métadonnées audio, save chip,
│                                      Save/Open, VU mètres, Render CTA
├── <MainGrid>                       — grid: scenes (1fr) | inspector (320px)
│   ├── <DualScene>                  — split horizontal 50/50
│   │   ├── <SceneTop />             — caméra orthographique au-dessus
│   │   └── <ScenePerspective />     — caméra perspective + OrbitControls
│   └── <Inspector />                — sections POSITION / MOTION / GAIN & FADES / DOPP
└── <Timeline />                     — transport (play/pause/stop + readouts) +
                                       waveform + ruler ; pleine largeur
```

> La `<TransportBar />` historique est **fusionnée** dans `<Timeline />` (bloc gauche), comme dans le screenshot de référence (`design/Screen Shot 2026-05-08 at 22.03.51.png`). Voir `DESIGN.md §6` pour la grille interne de la timeline.

Les deux scènes partagent le store : sélectionner ou drag un keyframe dans l'une se reflète dans l'autre. La vue Top reste fixe (caméra non-controllable) ; la vue Perspective accepte rotate/zoom via `OrbitControls`.

## 6. State (Zustand)

Un seul store `useProjectStore` avec :

```ts
{
  project: Project | null,
  selectedKeyframeId: string | null,
  playback: { isPlaying: boolean; currentTime: number },
  // actions
  loadAudio, addKeyframe, updateKeyframe, removeKeyframe,
  selectKeyframe, setPlayback, exportAudio, saveProject, loadProject
}
```

Le moteur audio (`AudioEngine` classe singleton dans `lib/audio-engine.ts`) **lit** le store mais ne le mute pas pour éviter les boucles ; il expose des méthodes (`play`, `pause`, `seek`, `applyKeyframes`) appelées par les actions du store.

## 7. Frontières IPC Rust ↔ JS

Commandes Tauri à exposer (minimales — beaucoup de choses peuvent rester côté JS) :

```rust
#[tauri::command] async fn read_audio_file(path: String) -> Result<AudioFileMeta, String>
#[tauri::command] async fn save_project(path: String, json: String) -> Result<(), String>
#[tauri::command] async fn load_project(path: String) -> Result<String, String>
#[tauri::command] async fn export_wav(path: String, samples: Vec<f32>, sample_rate: u32, channels: u16) -> Result<(), String>
```

Le décodage initial peut aussi se faire côté JS via `audioContext.decodeAudioData(arrayBuffer)` — plus simple. Côté Rust on intervient surtout pour l'export volumineux et la lecture de métadonnées.

## 8. Plateformes ciblées

| OS | Format binaire | Notes |
|---|---|---|
| macOS (universal) | `.dmg`, `.app` | signature Apple Developer ID recommandée hors CI personnel |
| Windows | `.msi`, `.exe` (NSIS) | WebView2 inclus automatiquement |
| Linux | `.AppImage`, `.deb`, `.rpm` | dépend de webkit2gtk |

CI suggérée : GitHub Actions avec matrice 3-OS via `tauri-action`.
