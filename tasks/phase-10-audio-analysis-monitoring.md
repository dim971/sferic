# Phase 10 — Audio analysis and realtime monitoring

## Goal

Add three things:

1. **Audio analysis on file open**: BPM and tonality (key/mode) detection, shown in the transport bar.
2. **Bar/Beat display** synced to playback (`BAR 21.3.1`).
3. **Realtime monitoring**: CPU indicator, audio buffer size, L/R peak meters.

## Part 1 — BPM detection

### Install

```bash
pnpm add web-audio-beat-detector
```

This library (~5 KB) takes an `AudioBuffer` and returns an estimated BPM. It uses an energy peak detector on the low band, reasonably accurate for popular music.

### Usage

In `src/lib/audio-analysis.ts`:

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

Call: in the store, after `loadAudioFile`, kick off the detection in the background and patch `project.audioMeta.bpm` when it returns. Don't block the UI.

```ts
loadAudioFile: async (path, arrayBuffer) => {
  // … existing decoding
  detectBpm(buffer).then(bpm => {
    if (bpm !== null) get().setAudioMeta({ bpm });
  });
}
```

### Manual editing

If the detection is wrong, the user can edit the BPM in the transport bar via a small clickable field (a number input that appears on click). Persist this value in priority over the detection.

## Part 2 — Tonality detection (optional / deferrable)

Key detection (G♯ min, etc.) is more complex. Two options:

### Option A — `essentia.js` (pro quality, ~3 MB)

```bash
pnpm add essentia.js
```

```ts
import { Essentia, EssentiaWASM } from 'essentia.js';

let essentia: Essentia | null = null;

export async function detectKey(buffer: AudioBuffer): Promise<string | null> {
  if (!essentia) essentia = new Essentia(EssentiaWASM);
  // Mono mix for Essentia
  const mono = mixToMono(buffer);
  const vec = essentia.arrayToVector(mono);
  const result = essentia.KeyExtractor(vec);
  return `${result.key} ${result.scale}`;  // e.g., "G# minor"
}
```

The downside: 3 MB added to the bundle, and the first init takes ~1 s.

### Option B — Defer

If you want to ship faster, **show `—`** instead of the tonality and mark this feature as "v1.5". The `audioMeta.key` data model stays planned to avoid breaking migration later.

**Recommendation**: option B at first, option A at the end of phase 10 if time allows.

## Part 3 — Bar/Beat display

Once the BPM is known, you can compute the position in bars/beats. We assume 4/4 and 16 sixteenths per bar by default.

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

Display in the transport bar: `BAR 21.3.1` (when `bpm !== null`, otherwise don't show this section).

## Part 4 — CPU monitoring

### Pragmatic approach

The "CPU 14.2%" in the screenshot represents the **audio engine** load, not the global process. We estimate it by the time spent in the AudioContext callback relative to the available duration:

```ts
class CpuMeter {
  private samples: number[] = [];
  private lastTime = performance.now();
  private worklet: AudioWorkletNode | null = null;

  // Worklet-less approach: estimate via render quantum (128 samples)
  // At 48kHz: quantum lasts 128/48000 = 2.67 ms
  // If we measure the time between two animation frames and assume
  // audio rendering takes a fraction X, we can publish X.
  // It's an approximation, but fine as an indicative display.

  measure(): number {
    // Minimal implementation: use AudioContext.baseLatency as a proxy
    // or actually integrate an AudioWorkletProcessor that measures its own time
    return this.fakeUntilImplemented();
  }
}
```

**Clean implementation**: add a dummy `AudioWorkletProcessor` that measures its time via internal `currentTime`, and emits this rate via `port.postMessage`. Doable but 100 extra lines of code.

**MVP implementation**: use a heuristic:

```ts
const cpuPercent = Math.min(99,
  (audioContext.currentTime - audioContext.outputLatency) / audioContext.currentTime * 100 * 0.15
);
```

Not exact but functional enough for visual feedback. Document it in a comment and mark it as "approximation".

**Refresh rate**: 4 times per second (`setInterval(250)`), no more.

## Part 5 — Buffer size

Direct read:

```ts
const bufferSize = Math.round(audioContext.outputLatency * audioContext.sampleRate);
// or audioContext.baseLatency * sampleRate depending on what the browser exposes
```

Display: `BUF 256` (in samples). If the value isn't available (old browsers), hide it.

## Part 6 — L/R VU meters

### Implementation

Add an `AnalyserNode` after `audioContext.destination`… no, after `destination` isn't connectable. You need to **duplicate the signal**: add a `ChannelSplitterNode` before destination, feeding:
1. `audioContext.destination` (headphone output)
2. A `ChannelSplitterNode` → 2 `AnalyserNode`s (L and R)

Modify the phase 9 graph to add this branch at the end:

```
… → mixOutput
        │
        ├──→ AnalyserNode (left)
        ├──→ AnalyserNode (right)
        └──→ destination
```

Concretely with a splitter:

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

### Reading levels

A `requestAnimationFrame` loop reads each analyser:

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

Convert to dB for display:

```ts
const db = peak === 0 ? -Infinity : 20 * Math.log10(peak);
// Displayed range: -60 dB → 0 dB
```

### `<MeterBar>` component

Create `src/components/transport/MeterBar.tsx` that takes `peakDb` as a prop and renders a segmented horizontal bar (screenshot style: ~12 LED segments, green below -6 dB, yellow between -6 and -3, red above). Use a smoothed state (fast attack, slower release) to avoid flicker.

Typical smoothing:

```ts
const smoothed = useRef(-60);
useEffect(() => {
  const loop = () => {
    const target = readPeak(analyser);
    const targetDb = target === 0 ? -60 : 20 * Math.log10(target);
    if (targetDb > smoothed.current) {
      smoothed.current = targetDb; // instant attack
    } else {
      smoothed.current = Math.max(targetDb, smoothed.current - 1.5); // release ~ 90 dB/s
    }
    setDisplayDb(smoothed.current);
    raf = requestAnimationFrame(loop);
  };
  // …
});
```

### UI placement

Topbar on the right: `CPU 14.2%  BUF 256  L [▮▮▮▮▮▯▯▯▯▯▯]  R [▮▮▮▮▮▮▯▯▯▯▯]` with the `<MeterBar>` component in two instances.

## Part 7 — Monitoring mode

Toggle in the transport bar: `BINAURAL · monitoring` ↔ `STEREO · bypass`.

- In `BINAURAL` mode: everything goes through the HRTF panner (default).
- In `STEREO` mode: bypass the panner and send the source audio directly to a neutral `StereoPannerNode`. Useful for A/B comparison.

Implementation: in `AudioEngine`, two parallel paths with gains we toggle (one to 0, the other to 1). Quick 50 ms crossfade to avoid clicks.

## Acceptance criterion

- Open an audio file → 1-2 s later, the BPM appears in the transport bar.
- During playback, the `BAR x.y.z` display advances coherently with the BPM.
- Clicking the BPM lets you edit it manually.
- The VU meters move in real time during playback, stay at -∞ on pause.
- The BINAURAL / STEREO toggle clearly produces an audible difference (in BINAURAL the sound rotates, in STEREO it's centred without spatialisation).
- The CPU / BUF display refreshes about 4 times per second.
- No regression on previous phases.

## Notes for the agent

- For tonality detection, **start with option B** (defer). If you finish early, integrate essentia.js.
- The CPU estimate doesn't need to be perfect. Clearly document it as an approximation.
- Segmented LED VU meters can be done in pure CSS (12 `<div>`s with fixed widths) — no need for SVG or Canvas.
- If you use essentia.js, its WASM loading can break the Vite bundle. Configure `optimizeDeps.exclude` if needed.

## Commit

```
feat(phase-10): BPM detection, L/R VU meters and realtime monitoring
```
