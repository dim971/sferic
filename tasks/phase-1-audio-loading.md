# Phase 1 — Audio loading + waveform

## Goal

Let the user open an audio file (WAV/MP3/FLAC/OGG/M4A), decode it, and display its waveform on an interactive timeline.

## Steps

1. **Define types** in `src/types/project.ts` (see `ARCHITECTURE.md §2`):
   ```ts
   export type CurveType = 'linear' | 'eaze' | 'smooth' | 'step';
   // 'eaze' = classic ease-in-out; 'smooth' = setTargetAtTime softened by tension.

   export interface SpatialKeyframe {
     id: string;
     time: number;
     position: { x: number; y: number; z: number };
     curve: CurveType;
     label?: string;

     // Motion (phase 5)
     duration?: number;
     tension?: number;

     // Gain & Fades (gainDb functional in phase 5; HPF/LPF UI stubs in v1, see DESIGN §9)
     gainDb?: number;
     snap?: boolean;
     hpfHz?: number;
     lpfHz?: number;

     // Doppler (UI stubs in v1)
     doppler?: boolean;
     velocity?: boolean;
     dopplerIntensity?: number;
   }

   export interface ProjectSettings {
     panningModel: 'HRTF' | 'equalpower';
     distanceModel: 'linear' | 'inverse' | 'exponential';
     refDistance: number;
     rolloffFactor: number;
     reverb: { enabled: boolean; wet: number };
     snapToSphere: boolean;
     doppler: { enabled: boolean; intensity: number };
   }

   export interface AudioFileMeta {
     originalPath: string;
     embeddedSampleRate: number;
     durationSec: number;
     channels: number;
   }

   export interface Project {
     version: 1;
     audioFile: AudioFileMeta;
     keyframes: SpatialKeyframe[];
     settings: ProjectSettings;
     meta: { createdAt: string; updatedAt: string; name: string };
   }
   ```

2. **Create the Zustand store** in `src/store/project-store.ts`:
   - State: `project`, `audioBuffer` (the decoded Web Audio `AudioBuffer`, kept out of the saved JSON), `selectedKeyframeId`, `playback: { isPlaying, currentTime }`.
   - Actions for this phase: `loadAudioFile(path: string, arrayBuffer: ArrayBuffer)`.
   - To decode: use a shared `AudioContext` exposed by `audio-engine.ts`.

3. **Implement `src/lib/audio-engine.ts`** (skeleton for this phase):
   ```ts
   class AudioEngineImpl {
     private ctx: AudioContext | null = null;
     getContext(): AudioContext {
       if (!this.ctx) this.ctx = new AudioContext();
       return this.ctx;
     }
     async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
       return this.getContext().decodeAudioData(arrayBuffer);
     }
   }
   export const AudioEngine = new AudioEngineImpl();
   ```

4. **Install common visual dependencies** (used in the Topbar and everywhere afterwards):
   ```bash
   pnpm add lucide-react @fontsource/inter @fontsource/jetbrains-mono
   ```
   Import the fonts in `src/main.tsx`:
   ```ts
   import "@fontsource/inter/400.css";
   import "@fontsource/inter/500.css";
   import "@fontsource/jetbrains-mono/400.css";
   ```
   Configure the default family in `index.css` (Tailwind 4 `@theme` layer or `body { font-family: ... }`) per `DESIGN.md §1.2`.

5. **Create `src/components/layout/Topbar.tsx`** following `DESIGN.md §3` (orange logo + text, File/Edit/Project/Render/View/Help menus, audio metadata in the centre, UNSAVED chip, orange outline Save/Open buttons, VU meter placeholders, filled orange Render button). For this phase, **only** the "Open" button and rendering of the loaded file's metadata are functional — Save / Render / VU stay visual (empty handlers or `disabled`), phases 5/6/7 will wire them.

   The **Open** button (`FolderOpen` icon + label):
   - Uses `@tauri-apps/plugin-dialog` → `open({ multiple: false, filters: [{ name: 'Audio', extensions: ['wav','mp3','flac','ogg','m4a','aac'] }] })`.
   - Reads the file via `@tauri-apps/plugin-fs` → `readFile(path)` (returns a `Uint8Array`).
   - Converts to `ArrayBuffer` and calls `loadAudioFile` on the store.

   Once audio is loaded, the Topbar's central area shows: track name (in `--accent`), `${sampleRate / 1000}k`, then file name in `--text-secondary`. Before loading: empty.

6. **Create `src/components/timeline/Waveform.tsx`** with **wavesurfer.js v7**:
   ```bash
   pnpm add wavesurfer.js
   ```
   - The component takes `audioBuffer: AudioBuffer | null` as a prop.
   - Initialises WaveSurfer with the design colours (see `DESIGN.md §6.2`):
     ```ts
     WaveSurfer.create({
       container,
       waveColor: '#F87328',
       progressColor: '#FF8A3D',
       cursorColor: '#FFFFFF',
       cursorWidth: 1,
       barWidth: 1,
       barGap: 1,
       barRadius: 0,
       height: 96,
     });
     ```
   - The container uses `bg-[--waveform-bg]`.
   - **Important**: to pass an already-decoded `AudioBuffer`, use `ws.loadDecodedBuffer(audioBuffer)` or in v7: `ws.load(url)` with a blob → prefer the first form via the v7-exposed `loadAudioBuffer` method.
   - Tear down cleanly (`ws.destroy()` in the `useEffect` cleanup).

7. **Update `src/App.tsx`** with the grid defined in `DESIGN.md §2`. In this phase, the central area (which will host `<DualScene />` + `<Inspector />` in phase 3–4) stays an empty placeholder at the right proportions:
   ```tsx
   import { Topbar } from '@/components/layout/Topbar';
   import { Waveform } from '@/components/timeline/Waveform';
   import { useProjectStore } from '@/store/project-store';

   export default function App() {
     const audioBuffer = useProjectStore((s) => s.audioBuffer);
     return (
       <div className="h-screen w-screen grid grid-rows-[44px_1fr_180px] grid-cols-[1fr_320px] bg-[--bg-base] text-[--text-primary]">
         <div className="col-span-2 border-b border-[--border-subtle]">
           <Topbar />
         </div>
         <div className="bg-[--bg-panel] border-r border-[--border-subtle] flex items-center justify-center text-[--text-dim] text-[12px]">
           {audioBuffer ? `${audioBuffer.duration.toFixed(2)}s · ${audioBuffer.numberOfChannels}ch · ${audioBuffer.sampleRate}Hz` : 'No file loaded'}
         </div>
         <div className="bg-[--bg-panel]" />{/* Inspector, empty for now */}
         <div className="col-span-2 bg-[--bg-panel] border-t border-[--border-subtle] p-3">
           <Waveform audioBuffer={audioBuffer} />
         </div>
       </div>
     );
   }
   ```

## Design

Refs: `DESIGN.md §3` (Topbar) and `§6.2` (waveform). Open the screenshot to calibrate the Topbar's density (`gap-3`, `text-[12px]` values) and the waveform tone (warm orange on a very dark brown background). The non-functional controls in phase 1 (Save, Render, VU) are rendered in their correct visual state but disabled or inert — **no crude "TODO" placeholders** in the bar.

## Acceptance criterion

- Clicking "Open" shows a native dialog.
- Picking an audio file → the waveform appears at the bottom with the design colours, file name + sample rate appear in the Topbar.
- Re-picking another file replaces the waveform correctly without memory leaks.
- The layout grid (44px / 1fr / 180px × 1fr / 320px) is in place even if the Inspector and scene areas are empty.
- No console warnings.

## Commit

```
feat(phase-1): audio loading and waveform display
```
