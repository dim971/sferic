# Phase 2 — Web Audio API audio engine

## Goal

Build the realtime audio engine with simple stereo playback (no automated spatialisation yet — that lands in phase 5). Set up the full graph so we can enrich it later.

## Steps

1. **Extend `src/lib/audio-engine.ts`**:

   ```ts
   import type { ProjectSettings } from '@/types/project';

   class AudioEngineImpl {
     private ctx: AudioContext | null = null;
     private source: AudioBufferSourceNode | null = null;
     private gain: GainNode | null = null;
     private panner: PannerNode | null = null;
     private convolver: ConvolverNode | null = null;
     private buffer: AudioBuffer | null = null;
     private startedAt = 0;
     private pausedAt = 0;
     private isPlaying = false;

     getContext(): AudioContext {
       if (!this.ctx) this.ctx = new AudioContext();
       return this.ctx;
     }

     async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
       return this.getContext().decodeAudioData(arrayBuffer);
     }

     setBuffer(buffer: AudioBuffer): void {
       this.buffer = buffer;
       this.pausedAt = 0;
     }

     applySettings(s: ProjectSettings): void {
       if (!this.panner) return;
       this.panner.panningModel = s.panningModel;
       this.panner.distanceModel = s.distanceModel;
       this.panner.refDistance = s.refDistance;
       this.panner.rolloffFactor = s.rolloffFactor;
     }

     play(offsetSec = this.pausedAt): void {
       if (!this.buffer) return;
       const ctx = this.getContext();
       this.stopInternal();

       const source = ctx.createBufferSource();
       source.buffer = this.buffer;

       const gain = ctx.createGain();
       gain.gain.value = 1;

       const panner = ctx.createPanner();
       panner.panningModel = 'HRTF';
       panner.distanceModel = 'inverse';
       panner.refDistance = 1;
       panner.rolloffFactor = 1;
       panner.positionX.value = 0;
       panner.positionY.value = 0;
       panner.positionZ.value = -1; // in front of the listener by default

       // Listener fixed at the origin, looking towards -Z
       const listener = ctx.listener;
       if (listener.forwardX) {
         listener.forwardX.value = 0;
         listener.forwardY.value = 0;
         listener.forwardZ.value = -1;
         listener.upX.value = 0;
         listener.upY.value = 1;
         listener.upZ.value = 0;
         listener.positionX.value = 0;
         listener.positionY.value = 0;
         listener.positionZ.value = 0;
       }

       source.connect(gain).connect(panner).connect(ctx.destination);
       source.start(0, offsetSec);

       this.source = source;
       this.gain = gain;
       this.panner = panner;
       this.startedAt = ctx.currentTime - offsetSec;
       this.isPlaying = true;

       source.onended = () => {
         if (this.isPlaying) {
           this.isPlaying = false;
           this.pausedAt = 0;
         }
       };
     }

     pause(): void {
       if (!this.isPlaying) return;
       const ctx = this.getContext();
       this.pausedAt = ctx.currentTime - this.startedAt;
       this.stopInternal();
       this.isPlaying = false;
     }

     stop(): void {
       this.stopInternal();
       this.pausedAt = 0;
       this.isPlaying = false;
     }

     seek(timeSec: number): void {
       const wasPlaying = this.isPlaying;
       this.stopInternal();
       this.pausedAt = Math.max(0, Math.min(timeSec, this.buffer?.duration ?? 0));
       if (wasPlaying) this.play(this.pausedAt);
     }

     getCurrentTime(): number {
       if (!this.isPlaying) return this.pausedAt;
       const ctx = this.getContext();
       return Math.min(ctx.currentTime - this.startedAt, this.buffer?.duration ?? 0);
     }

     private stopInternal(): void {
       if (this.source) {
         try { this.source.stop(); } catch { /* already stopped */ }
         this.source.disconnect();
         this.source = null;
       }
       if (this.gain) { this.gain.disconnect(); this.gain = null; }
       if (this.panner) { this.panner.disconnect(); this.panner = null; }
     }
   }

   export const AudioEngine = new AudioEngineImpl();
   ```

2. **Wire the store to the engine** in `project-store.ts`:
   - When `audioBuffer` changes, call `AudioEngine.setBuffer(audioBuffer)`.
   - Add actions: `play()`, `pause()`, `stop()`, `seek(time)`.
   - These actions just call `AudioEngine.<method>()` then `set({ playback: { isPlaying, currentTime } })`.

3. **Create a `currentTime` update loop**:
   - In a hook `useTransportSync()` in `src/lib/use-transport-sync.ts`:
     ```ts
     export function useTransportSync(): void {
       const isPlaying = useProjectStore((s) => s.playback.isPlaying);
       const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
       useEffect(() => {
         if (!isPlaying) return;
         let raf: number;
         const tick = () => {
           setCurrentTime(AudioEngine.getCurrentTime());
           raf = requestAnimationFrame(tick);
         };
         raf = requestAnimationFrame(tick);
         return () => cancelAnimationFrame(raf);
       }, [isPlaying, setCurrentTime]);
     }
     ```
   - Call this hook once in `App.tsx`.

4. **Create `src/components/transport/TransportBar.tsx`** (see `DESIGN.md §6.1`). This component will be **composed inside `<Timeline />`** in phase 3 (left block of the timeline), not placed under the waveform:
   - Three icon buttons `Play` / `Pause` / `Square` (stop) from `lucide-react`, 16px, colour `--accent`. Active button: `--accent-soft` background.
   - Time display `m:ss` in `text-[14px] font-mono text-[--text-primary]` (e.g. `1:23` in the screenshot).
   - Volume slider (master gain, 0..1.5) — can stay discreet in phase 2 (small horizontal `--accent` slider), later replaced by the VU meters in the Topbar (phase 5).
   - No seek slider in the TransportBar: seeking is done by clicking on the waveform (phase 4). If needed for debug in phase 2, keep an invisible slider or a numeric input.

5. **Update `App.tsx`**: at this stage, the `TransportBar` is temporarily placed in the existing layout grid's "Inspector" cell (320px right), or at the bottom-left of the Timeline area if the grid is already in place. **The final goal** (phase 3) is that it lives in the Timeline row (see `DESIGN.md §2`). Call `useTransportSync()` once in `App.tsx`.

## Design

Ref: `DESIGN.md §6.1` (TransportBar). Icons come from `lucide-react` (already installed in phase 1) — `Play`, `Pause`, `Square`. Time uses the mono font already configured. No frills — the TransportBar is compact (≈ 32px tall, minimal padding).

## Acceptance criterion

- Load a file then click Play → the sound plays in stereo.
- Pause / Stop / Seek work.
- The time counter advances in real time.
- The volume slider really changes the level.
- Transport button icons/colours match `DESIGN.md §6.1`.

## Notes for the agent

- The `PannerNode` is instantiated now to prepare phase 5, even though its position stays fixed for now.
- On some browsers (and the Tauri WebView), `AudioContext` must be created after a user interaction. Trigger `getContext()` from the "Open" button handler if needed.

## Commit

```
feat(phase-2): Web Audio API engine with play/pause/seek transport
```
