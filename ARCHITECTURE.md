# Architecture technique

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
interface SpatialKeyframe {
  id: string;           // uuid
  time: number;         // en secondes depuis le début du morceau
  position: {
    x: number;          // -1 (gauche) à 1 (droite)
    y: number;          // -1 (bas) à 1 (haut)
    z: number;          // -1 (avant) à 1 (arrière) ; rayon recommandé : 1
  };
  curve: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step';
  label?: string;
}
```

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

## 4. Rendu offline

Pour exporter, on duplique le graphe ci-dessus dans un `OfflineAudioContext` initialisé à la durée et au sample rate du fichier source. On reprogramme toutes les automations depuis `t=0`, on appelle `startRendering()` qui retourne un `AudioBuffer`, qu'on encode :

- **WAV** : sérialisation manuelle PCM 16-bit ou 24-bit (utilitaire dans `lib/wav-encoder.ts`)
- **MP3** : `@breezystack/lamejs` (LAME compilé en JS, fonctionne en main thread, OK pour <30 min)

Pour les très gros fichiers (>1h), on peut déléguer l'encodage WAV à Rust via un `tauri::command` qui reçoit le `AudioBuffer` sérialisé en `Float32Array` et utilise `hound`.

## 5. Composants React principaux

```
<App>
├── <Topbar />                 — ouvrir / sauver / exporter
├── <MainLayout>
│   ├── <SpatialScene />       — sphère 3D + auditeur + keyframes (R3F)
│   ├── <Timeline />           — waveform + curseur + marqueurs keyframes
│   └── <Inspector />          — édition keyframe sélectionnée + settings projet
└── <TransportBar />           — play/pause/stop, temps courant, volume
```

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
