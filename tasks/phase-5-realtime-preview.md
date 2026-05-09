# Phase 5 — Realtime playback with HRTF spatialisation

## Goal

Tie the keyframes to the audio engine's HRTF `PannerNode` so that playback **is** spatialised. This is the heart of the "8D" effect.

## Steps

1. **Add an `applyKeyframeAutomation` method to `AudioEngine`** that automates position **and** gain per keyframe:
   ```ts
   applyKeyframeAutomation(keyframes: SpatialKeyframe[], startOffsetSec: number): void {
     if (!this.panner || !this.gain || !this.ctx) return;
     const ctx = this.ctx;
     const t0 = ctx.currentTime; // at playback start

     // Reset scheduled automations
     [this.panner.positionX, this.panner.positionY, this.panner.positionZ, this.gain.gain]
       .forEach(p => p.cancelScheduledValues(t0));

     const sorted = [...keyframes].sort((a, b) => a.time - b.time);
     for (const kf of sorted) {
       if (kf.time < startOffsetSec) continue;
       const audioTime = t0 + (kf.time - startOffsetSec);
       const tension = kf.tension ?? 0.5;

       schedulePos(this.panner.positionX, kf.position.x, audioTime, kf.curve, tension);
       schedulePos(this.panner.positionY, kf.position.y, audioTime, kf.curve, tension);
       schedulePos(this.panner.positionZ, kf.position.z, audioTime, kf.curve, tension);

       // Per-keyframe gain (gainDb → linear)
       const linGain = Math.pow(10, (kf.gainDb ?? 0) / 20);
       schedulePos(this.gain.gain, linGain, audioTime, kf.curve, tension);
     }
   }
   ```

   With a local helper:
   ```ts
   function schedulePos(
     p: AudioParam, value: number, time: number,
     curve: CurveType, tension: number
   ): void {
     switch (curve) {
       case 'step':   p.setValueAtTime(value, time); return;
       case 'linear': p.linearRampToValueAtTime(value, time); return;
       case 'eaze':   p.setTargetAtTime(value, time, 0.25); return;            // ease-in-out approx
       case 'smooth': p.setTargetAtTime(value, time, 0.05 + tension * 0.4); return; // tension controls smoothing
     }
   }
   ```

   > The keyframe's `hpfHz`, `lpfHz`, `doppler`, `velocity`, `dopplerIntensity` fields stay **stubs in v1** — their values are stored and read by the inspector, but not applied to the audio graph. See `DESIGN.md §9`.

2. **Modify `play(offsetSec)`**:
   - After building the graph, call `applyKeyframeAutomation(currentProject.keyframes, offsetSec)`.
   - Receive the keyframes as a parameter from the store, OR expose a `setKeyframes(kfs[])` setter that the store calls when `project.keyframes` changes.
   - **Prefer**: passing `keyframes` to `play(offsetSec, keyframes)` to stay explicit.

3. **Reschedule the automation every time keyframes are modified during playback**:
   - In the store, after `addKeyframe` / `updateKeyframe` / `removeKeyframe`, if `playback.isPlaying`, call `AudioEngine.applyKeyframeAutomation(keyframes, AudioEngine.getCurrentTime())`.

4. **Implement optional reverb**:
   - Load a short IR (impulse response) from `src/assets/ir/room.wav` (drop a royalty-free one in, e.g. Freesound CC0, or generate a very short synthetic IR in code).
   - If `settings.reverb.enabled`, wire: `panner → convolver → wetGain → destination` in parallel with `panner → dryGain → destination` (dry/wet cross-fade).

5. **Wire the Topbar VU meters** (see `DESIGN.md §3` point 6):
   - Insert an `AnalyserNode` (fftSize=256) between the `panner` and `ctx.destination`.
   - Create `src/components/layout/VuMeter.tsx` that takes the analyser as a prop, reads `getByteTimeDomainData` on each `requestAnimationFrame`, computes the L and R peaks, and renders two columns of 14 segments (`--vu-green` × 10, `--vu-yellow` × 3, `--vu-red` × 1) lit/unlit by level.
   - If the engine isn't started, the VUs stay off (no errors).

6. **Verify behaviour with headphones**:
   - Add 4 keyframes forming a horizontal circle (left, front, right, back) over 8 seconds.
   - On headphones, you should clearly hear the sound rotating around your head.

## Design

Ref: `DESIGN.md §3` (VU meters in the Topbar) and `§5.4` (functional Vol). At this phase, what was a visual stub becomes **alive**: VUs move during playback, per-keyframe `Vol` actually changes the audio level. Verify the VUs don't saturate too easily (calibrate green/yellow/red thresholds) and that gain transitions don't cause pops.

## Acceptance criterion

- With ≥ 2 keyframes at different positions, playback genuinely spatialises the sound (testable on headphones).
- Modifying a keyframe during playback updates the trajectory in under ~100 ms.
- Seek still works and correctly reschedules the remaining automations.
- Per-keyframe `Vol` (gainDb) really acts on the audio level.
- The Topbar VU meters move in real time during playback, and stay off when stopped.
- No audible audio glitches at keyframe transitions.

## Commit

```
feat(phase-5): realtime HRTF spatialisation via PannerNode automation
```
