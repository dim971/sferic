# Phase 6 — Offline export (WAV/MP3 render)

## Goal

Export the spatialised track as a stereo audio file with the effect "baked in" (the user can share it / play it in any player).

## Steps

1. **Create `src/lib/wav-encoder.ts`**:
   ```ts
   export function encodeWav(buffer: AudioBuffer): Uint8Array {
     const numChannels = buffer.numberOfChannels;
     const sampleRate = buffer.sampleRate;
     const length = buffer.length * numChannels * 2 + 44;
     const out = new ArrayBuffer(length);
     const view = new DataView(out);

     // RIFF header
     writeString(view, 0, 'RIFF');
     view.setUint32(4, length - 8, true);
     writeString(view, 8, 'WAVE');
     writeString(view, 12, 'fmt ');
     view.setUint32(16, 16, true);
     view.setUint16(20, 1, true); // PCM
     view.setUint16(22, numChannels, true);
     view.setUint32(24, sampleRate, true);
     view.setUint32(28, sampleRate * numChannels * 2, true);
     view.setUint16(32, numChannels * 2, true);
     view.setUint16(34, 16, true);
     writeString(view, 36, 'data');
     view.setUint32(40, length - 44, true);

     // PCM 16-bit interleaved
     let offset = 44;
     const channels: Float32Array[] = [];
     for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
     for (let i = 0; i < buffer.length; i++) {
       for (let c = 0; c < numChannels; c++) {
         const s = Math.max(-1, Math.min(1, channels[c][i]));
         view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
         offset += 2;
       }
     }
     return new Uint8Array(out);
   }

   function writeString(v: DataView, offset: number, s: string) {
     for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
   }
   ```

2. **Create `src/lib/render-offline.ts`**:
   ```ts
   import type { Project } from '@/types/project';
   import type { SpatialKeyframe, CurveType } from '@/types/project';

   export async function renderProject(
     project: Project,
     audioBuffer: AudioBuffer
   ): Promise<AudioBuffer> {
     const offline = new OfflineAudioContext({
       numberOfChannels: 2, // HRTF stereo
       length: Math.ceil(audioBuffer.duration * audioBuffer.sampleRate),
       sampleRate: audioBuffer.sampleRate,
     });

     const source = offline.createBufferSource();
     source.buffer = audioBuffer;

     const gain = offline.createGain();
     const panner = offline.createPanner();
     panner.panningModel = project.settings.panningModel;
     panner.distanceModel = project.settings.distanceModel;
     panner.refDistance = project.settings.refDistance;
     panner.rolloffFactor = project.settings.rolloffFactor;

     // Initial position: first keyframe or (0,0,-1)
     const sorted = [...project.keyframes].sort((a, b) => a.time - b.time);
     const initial = sorted[0]?.position ?? { x: 0, y: 0, z: -1 };
     panner.positionX.value = initial.x;
     panner.positionY.value = initial.y;
     panner.positionZ.value = initial.z;

     // Schedule automations from t=0 in the OfflineAudioContext
     for (const kf of sorted) {
       schedule(panner.positionX, kf.position.x, kf.time, kf.curve);
       schedule(panner.positionY, kf.position.y, kf.time, kf.curve);
       schedule(panner.positionZ, kf.position.z, kf.time, kf.curve);
     }

     source.connect(gain).connect(panner).connect(offline.destination);
     source.start(0);

     return offline.startRendering();
   }

   function schedule(p: AudioParam, value: number, time: number, curve: CurveType) {
     if (curve === 'step') p.setValueAtTime(value, time);
     else if (curve === 'linear') p.linearRampToValueAtTime(value, time);
     else {
       const tau = curve === 'easeIn' ? 0.4 : curve === 'easeOut' ? 0.15 : 0.25;
       p.setTargetAtTime(value, time, tau);
     }
   }
   ```

3. **Add MP3 encoding (optional)**:
   ```bash
   pnpm add @breezystack/lamejs
   ```
   Create `src/lib/mp3-encoder.ts` that takes a stereo `AudioBuffer` and returns a 128kbps MP3 `Uint8Array`.

4. **Activate the "Render" button** already present in the `Topbar` since phase 1 (filled orange CTA, see `DESIGN.md §3` point 7). On click, open a centred modal (`--bg-panel` background, `--border-strong` border, max-width 420px):
   - Format: WAV / MP3 (radio).
   - If MP3: bitrate (128 / 192 / 320 kbps, segmented).
   - Bottom buttons: outline `Cancel` + filled orange `Render`.
   - On Render click:
     1. Show a spinner with "Rendering…" inside the modal.
     2. Call `renderProject(project, audioBuffer)`.
     3. Encode (`encodeWav` or `encodeMp3`).
     4. Open `dialog.save({ defaultPath: ${name}.wav })`.
     5. Write with `fs.writeFile(path, bytes)` (Tauri plugin).
     6. Close the modal and show a "Exported ✓" toast (toast in design colours: `--bg-panel-elev` background, `--accent` accent on the left).

5. **Handle performance**:
   - For files > 5 min, the offline render can take several seconds but should stay < the track's duration (Chromium implementations run at ~5–20× realtime).
   - Show a progress bar if possible (`OfflineAudioContext` doesn't expose progress — an indeterminate spinner is fine).

## Design

Ref: `DESIGN.md §3` (Render CTA). The modal and toast must reuse the global palette (never solid white, never foreign colours). The Render button is **the** main CTA of the app — it must always be visible in the Topbar, even when no file is loaded (but disabled in that case).

## Acceptance criterion

- The Render button is visible in the Topbar from phase 1, disabled until audio is loaded, active otherwise.
- Load a file, add a few keyframes, click Render → modal opens, pick WAV → file saved.
- The WAV played in another player (VLC, QuickTime…) on headphones reproduces the spatial effect heard in preview.
- MP3 export works and produces a file readable everywhere.
- No UI freeze during the render (offline render doesn't block the main thread, but WAV encoding is synchronous — for > 100 MB, doing it in a Worker is a plus but not required at this stage).
- Modal and toast respect the design palette.

## Commit

```
feat(phase-6): offline WAV and MP3 export
```
