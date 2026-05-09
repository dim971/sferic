# Phase 9 — Extended keyframe properties

## Goal

Extend the data model and audio engine to support, **per keyframe**:
- Gain in dB
- Low-pass filter (LPF)
- High-pass filter (HPF)
- Doppler on/off
- Air absorption (high-frequency rolloff with distance)
- Reverb send (send to the global reverb)
- Tension (parameter of the `cubic` curve)

And add the **`cubic`** curve type (Catmull-Rom interpolation parameterised by tension) on top of `hold`, `linear`, `ease-out`. Also rename the existing curves to match the design's nomenclature.

These automations are **sample-accurate** because they're scheduled via Web Audio API `AudioParam`s.

## Data model migration

### New keyframe type

Replace `SpatialKeyframe` in `src/types/project.ts`:

```ts
export type CurveType = 'hold' | 'linear' | 'ease-out' | 'cubic';

export interface SpatialKeyframe {
  id: string;
  time: number;
  position: { x: number; y: number; z: number };
  curve: CurveType;
  tension: number;        // 0..1, only used if curve === 'cubic'
  gain: number;           // dB, [-60, +12], default 0
  lpf: number | null;     // Hz [200, 22000], null = bypass
  hpf: number | null;     // Hz [20, 2000], null = bypass
  doppler: boolean;       // default true
  airAbsorption: number;  // [0, 1], default 0.18
  reverbSend: number | null; // [0, 1], null = use global
  label?: string;
}
```

### New Project type

```ts
export interface Project {
  version: 2;             // was 1
  audioFile: AudioFileMeta;
  keyframes: SpatialKeyframe[];
  settings: ProjectSettings;
  audioMeta: { bpm: number | null; key: string | null }; // filled by phase 10
  meta: { createdAt: string; updatedAt: string; name: string };
}
```

### v1 → v2 migration

Create `src/lib/migrate.ts`:

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

Import `migrateProject` into `loadProject` (phase 7).

## New audio graph

Replace the graph built in `AudioEngine.play()` with:

```
AudioBufferSourceNode
        │
        ▼
   GainNode (master, controlled by the volume slider)
        │
        ▼
   GainNode (per-keyframe gain, automated dB → linear)
        │
        ▼
   BiquadFilterNode (HPF, type='highpass', frequency automated; bypass if null = freq=0)
        │
        ▼
   BiquadFilterNode (LPF, type='lowpass',  frequency automated; bypass if null = freq=22050)
        │
        ▼
   BiquadFilterNode (air absorption, type='lowpass', frequency = f(distance, airAbsorption))
        │
        ▼
   PannerNode (HRTF, position automated — phase 5)
        │
        ├──────────────┐
        ▼              ▼
   GainNode        ConvolverNode (reverb)
   (dry, fixed)        │
        │              ▼
        │         GainNode (wet, automated by reverbSend)
        │              │
        └──────┬───────┘
               ▼
       AudioContext.destination
```

### `AudioEngine` implementation

Extend the class with fields and methods:

```ts
private gainKf: GainNode | null = null;
private hpf: BiquadFilterNode | null = null;
private lpf: BiquadFilterNode | null = null;
private airLpf: BiquadFilterNode | null = null;
private dry: GainNode | null = null;
private convolver: ConvolverNode | null = null;
private wet: GainNode | null = null;

applyKeyframeAutomation(keyframes, startOffsetSec) {
  // ... extended: schedule for each keyframe
  //   - gainKf.gain (linear = 10 ** (dB / 20))
  //   - hpf.frequency (0 if null)
  //   - lpf.frequency (22050 if null)
  //   - airLpf.frequency (computed from distance and airAbsorption)
  //   - panner.positionX/Y/Z (already done in phase 5)
  //   - wet.gain (per-keyframe override or global based on reverbSend)
}
```

### Air absorption computation

Simple approximation: the absorption LPF's cutoff frequency drops with distance and with the absorption factor:

```ts
function airAbsorptionCutoff(distance: number, airAbs: number): number {
  // distance ~ [0, 2], airAbs ~ [0, 1]
  // At distance 0: cutoff = 22050 Hz (transparent)
  // At distance 2 and airAbs=1: cutoff ~ 2000 Hz (very muffled)
  const k = airAbs * Math.min(distance, 2);
  return 22050 * Math.exp(-k * 1.2);
}
```

Schedule `airLpf.frequency` at each keyframe with the function above, using the keyframe's position to compute its distance from the listener (radius `√(x²+y²+z²)`).

### Doppler — pragmatic implementation

The Web Audio `PannerNode` **no longer** has built-in Doppler handling (removed from the spec). For this phase, implement only the **toggle in the UI and the data model**, but **don't apply any actual pitch shifting** on the audio side. Clearly document the "stub" status with a code comment:

```ts
// TODO: Doppler effect — Web Audio API no longer provides native automation.
// Manual implementation possible via a modulated DelayNode or the source's playbackRate,
// but the complexity cost isn't justified for v1. Stub for now.
```

The user will see the toggle in the UI and it will be persisted in the project; only the actual rendering is deferred. To iterate later.

### `cubic` curve with tension

For audio automations, the Web Audio API offers `setValueCurveAtTime(curveArray, time, duration)` which lets you schedule an array of values. We use it for cubic curves:

```ts
function buildCubicCurve(from: number, to: number, tension: number, samples = 64): Float32Array {
  // Catmull-Rom-like with tension: t' = lerp with parameterised easing
  const arr = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    // Hermite with tangents scaled by tension
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

// then when scheduling:
const dur = nextKf.time - kf.time;
audioParam.setValueCurveAtTime(buildCubicCurve(kf.value, nextKf.value, kf.tension), startTime, dur);
```

## UI — Enriched Inspector

Extend the `Inspector` component added in phase 4 with the following sections, in this order:

### `POSITION` section

Unit toggle in the top-right: `cartesian · m` ↔ `polar · ° / m`.

- Cartesian mode: sliders + numeric inputs X / Y / Z (range −2..+2 m, step 0.001)
- Polar mode: Az (azimuth) °, El (elevation) °, Dist (radius) m
- Polar ↔ cartesian conversion in `src/lib/math3d.ts`:
  ```ts
  // azimuth: horizontal angle from +X in the X/Z plane, counter-clockwise from above
  // elevation: angle upward from the X/Z plane
  export function cartToSpherical(p): { az: number; el: number; r: number } { … }
  export function sphericalToCart(s): { x: number; y: number; z: number } { … }
  ```

### `MOTION` section

- 4 toggle buttons (radio group): `hold` / `linear` / `ease-out` / `cubic`
- Display `Duration: +N.000s → kfNN` (computed dynamically: duration to the next keyframe by ascending `time`)
- `Tension` slider (0..1, disabled if curve ≠ cubic)

### `GAIN & FILTER` section

- Numeric `Gain` field (dB, range −60..+12, step 0.1)
- Numeric `LPF` field (Hz, range 200..22000, step 100, displayed in kHz if > 1000) with bypass toggle
- Numeric `HPF` field (Hz, range 20..2000, step 10) with bypass toggle
- `Doppler` toggle (on/off)

### `SEND` section

- `Reverb` percentage field (0..100 %) with a small "auto" button that resets it to null (use global)
- Numeric `Air absorb` field (0..1, step 0.01)

## "+ KEYFRAME" button

In the transport bar, add an orange CTA button `+ KEYFRAME` that:
1. Computes the current interpolated position (existing `interpolatePosition` function)
2. Creates a keyframe at that position at the current time
3. Inherits the audio parameters (gain/lpf/hpf/etc.) from the previous keyframe in time, or default values if none
4. Automatically selects the new keyframe

## Live reprogramming

If the user edits any audio parameter on a keyframe during playback, you must **immediately** reschedule the automations from the current time. Implement in the store:

```ts
updateKeyframe: (id, partial) => {
  set(state => { /* update */ });
  if (get().playback.isPlaying) {
    AudioEngine.applyKeyframeAutomation(get().project!.keyframes, AudioEngine.getCurrentTime());
  }
}
```

## Acceptance criterion

- Load an audio file, create 3 keyframes with different gains (-12, 0, +6 dB) → you clearly hear the difference during playback.
- Setting an LPF at 800 Hz on a keyframe: the section between this keyframe and the next must sound muffled, then become clear again afterwards.
- Doppler toggle has no audio effect (stub) but the value is preserved across save/reload.
- Per-keyframe reverb send: going from 0 to 80 % between two keyframes makes the reverb tail rise progressively.
- Migration: opening a v1 project saved before this phase works (test by keeping a v1 `.sferic.json` around).
- Cubic curve with tension 0 = nearly step, tension 1 = smooth.
- The inspector correctly displays all the new sections.

## Commit

```
feat(phase-9): extended keyframe properties (gain, filters, send, cubic curve)
```
