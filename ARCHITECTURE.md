# Technical architecture

> **Visual identity**: `DESIGN.md` is the source of truth for everything related to rendering (colours, typography, layout, components). This architecture defines the technical contour; `DESIGN.md` defines the look. In case of a visual/technical conflict, see `DESIGN.md §10` for the priority order.

## 1. Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri 2 (native binary)                  │
│  ┌──────────────────────┐    ┌───────────────────────────┐  │
│  │   Rust backend       │    │   Frontend (WebView)      │  │
│  │   ─────────────      │◄──►│   ─────────────────       │  │
│  │   • audio decoding   │ IPC│   • React + TypeScript    │  │
│  │     (symphonia)      │    │   • Web Audio API engine  │  │
│  │   • file I/O         │    │   • Three.js 3D scene     │  │
│  │   • WAV encoding     │    │   • WaveSurfer timeline   │  │
│  │   • fs/dialog plugin │    │   • Zustand store         │  │
│  └──────────────────────┘    └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 2. Data model

### `SpatialKeyframe`
```ts
type CurveType = 'linear' | 'eaze' | 'smooth' | 'step';
// 'eaze' = classic ease-in-out; 'smooth' = setTargetAtTime softened by `tension`.

interface SpatialKeyframe {
  id: string;           // uuid
  time: number;         // seconds since track start
  position: {
    x: number;          // -1 (left) to 1 (right)
    y: number;          // -1 (bottom) to 1 (top)
    z: number;          // -1 (front) to 1 (back); recommended radius: 1
  };
  curve: CurveType;
  label?: string;

  // Motion (phase 5)
  duration?: number;    // s, override of the gap from the previous keyframe (default = gap)
  tension?: number;     // 0..1, only meaningful when curve === 'smooth'

  // Gain & Fades (phase 5 for gainDb; HPF/LPF stay UI stubs in v1, see DESIGN §9)
  gainDb?: number;      // -24..+6, default 0
  snap?: boolean;       // true = position is forced to r=1 (snap-to-sphere), default = settings.snapToSphere
  hpfHz?: number;       // 20..2000, v1 stub
  lpfHz?: number;       // 200..20000, v1 stub

  // Doppler (v1 stubs)
  doppler?: boolean;        // enables frequency shift
  velocity?: boolean;       // enables velocity-driven gain modulation
  dopplerIntensity?: number; // 0..1
}
```

> All fields beyond `id/time/position/curve/label` are optional and stored in the saved project. See `DESIGN.md §9` for the "functional vs stub" status in v1.

### `Project`
```ts
interface Project {
  version: 1;
  audioFile: {
    originalPath: string;     // absolute path of origin
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
    snapToSphere: boolean;                       // default true — sticks new keyframes to r=1
    doppler: { enabled: boolean; intensity: number }; // global, v1 stub (see DESIGN §9)
  };
  meta: { createdAt: string; updatedAt: string; name: string };
}
```

Save format: `.sferic.json` (human-readable, versioned).

## 3. Audio graph (realtime)

```
AudioBufferSourceNode
        │
        ▼
   GainNode (master volume)
        │
        ▼
   PannerNode (panningModel: 'HRTF')   ←── 3D automation from keyframes
        │            ▲
        │            │ AudioListener (fixed at 0,0,0)
        ▼
   ConvolverNode (optional reverb)
        │
        ▼
   AudioContext.destination
```

Position automation goes through `pannerNode.positionX.setValueAtTime(...)` and `setTargetAtTime(...)` or `linearRampToValueAtTime(...)` depending on the curve chosen for each keyframe. **This native Web Audio automation is sample-accurate** — no JS timer needed.

The master `GainNode` is also automated per keyframe (`gainDb` → `gain.setTargetAtTime`). The `BiquadFilterNode` HPF/LPF nodes, plus Doppler/Velocity modulation, are **planned** in the graph but **stubs in v1**: their values are stored in the keyframe but not wired in phase 5. See `DESIGN.md §9`.

## 4. Offline render

To export, we duplicate the graph above in an `OfflineAudioContext` initialised with the source file's duration and sample rate. We reprogram every automation from `t=0`, call `startRendering()` which returns an `AudioBuffer`, and encode:

- **WAV** — manual 16-bit or 24-bit PCM serialisation (helper in `lib/wav-encoder.ts`)
- **MP3** — `@breezystack/lamejs` (LAME compiled to JS, runs on the main thread, fine for <30 min)

For very large files (>1 h), WAV encoding can be delegated to Rust through a `tauri::command` that receives the `AudioBuffer` serialised as a `Float32Array` and uses `hound`.

## 5. Main React components

```
<App>
├── <Topbar />                       — logo, menus, audio metadata, save chip,
│                                      Save/Open, VU meters, Render CTA
├── <MainGrid>                       — grid: scenes (1fr) | inspector (320px)
│   ├── <DualScene>                  — horizontal 50/50 split
│   │   ├── <SceneTop />             — orthographic camera from above
│   │   └── <ScenePerspective />     — perspective camera + OrbitControls
│   └── <Inspector />                — POSITION / MOTION / GAIN & FADES / DOPP sections
└── <Timeline />                     — transport (play/pause/stop + readouts) +
                                       waveform + ruler; full width
```

> The historical `<TransportBar />` is **merged** into `<Timeline />` (left block), as in the reference screenshot (`design/Screenshot 2026-05-09 at 08.53.47.png`). See `DESIGN.md §6` for the timeline's internal grid.

Both scenes share the store: selecting or dragging a keyframe in one is reflected in the other. The Top view stays fixed (camera not controllable); the Perspective view accepts rotate/zoom via `OrbitControls`.

## 6. State (Zustand)

A single `useProjectStore` with:

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

The audio engine (`AudioEngine` singleton class in `lib/audio-engine.ts`) **reads** the store but never mutates it to avoid loops; it exposes methods (`play`, `pause`, `seek`, `applyKeyframes`) called by the store actions.

## 7. Rust ↔ JS IPC boundaries

Tauri commands to expose (minimal — most things stay on the JS side):

```rust
#[tauri::command] async fn read_audio_file(path: String) -> Result<AudioFileMeta, String>
#[tauri::command] async fn save_project(path: String, json: String) -> Result<(), String>
#[tauri::command] async fn load_project(path: String) -> Result<String, String>
#[tauri::command] async fn export_wav(path: String, samples: Vec<f32>, sample_rate: u32, channels: u16) -> Result<(), String>
```

Initial decoding can also happen on the JS side via `audioContext.decodeAudioData(arrayBuffer)` — simpler. Rust gets involved mainly for large exports and metadata reads.

## 8. Target platforms

| OS | Binary format | Notes |
|---|---|---|
| macOS (universal) | `.dmg`, `.app` | Apple Developer ID signing recommended outside personal CI |
| Windows | `.msi`, `.exe` (NSIS) | WebView2 included automatically |
| Linux | `.AppImage`, `.deb`, `.rpm` | depends on webkit2gtk |

Suggested CI: GitHub Actions with a 3-OS matrix via `tauri-action`.
