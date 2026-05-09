import type { CurveType, ProjectSettings, SpatialKeyframe } from '@/types/project';
import { airAbsorptionCutoff } from '@/lib/math3d';

function gainFromDb(db: number): number {
  return Math.pow(10, db / 20);
}

function distanceOf(p: { x: number; y: number; z: number }): number {
  return Math.hypot(p.x, p.y, p.z);
}

const SOUND_SPEED = 343; // m/s, our world units ≈ metres

function dopplerFactor(kf: SpatialKeyframe, sortedAll: SpatialKeyframe[]): number {
  if (!kf.doppler) return 1;
  const idx = sortedAll.findIndex((k) => k.id === kf.id);
  if (idx < 0) return 1;
  const prev = sortedAll[idx - 1];
  const next = sortedAll[idx + 1];
  let vx = 0;
  let vy = 0;
  let vz = 0;
  if (prev && next && next.time > prev.time) {
    const dt = next.time - prev.time;
    vx = (next.position.x - prev.position.x) / dt;
    vy = (next.position.y - prev.position.y) / dt;
    vz = (next.position.z - prev.position.z) / dt;
  } else if (prev && kf.time > prev.time) {
    const dt = kf.time - prev.time;
    vx = (kf.position.x - prev.position.x) / dt;
    vy = (kf.position.y - prev.position.y) / dt;
    vz = (kf.position.z - prev.position.z) / dt;
  } else if (next && next.time > kf.time) {
    const dt = next.time - kf.time;
    vx = (next.position.x - kf.position.x) / dt;
    vy = (next.position.y - kf.position.y) / dt;
    vz = (next.position.z - kf.position.z) / dt;
  } else {
    return 1;
  }
  const r = Math.hypot(kf.position.x, kf.position.y, kf.position.z);
  if (r < 1e-3) return 1;
  const dx = kf.position.x / r;
  const dy = kf.position.y / r;
  const dz = kf.position.z / r;
  // Radial velocity: positive = source moving away from listener
  const vRadial = vx * dx + vy * dy + vz * dz;
  // Standard Doppler for moving source: f' = f * c / (c + v_r). Source receding ↓pitch.
  const factor = SOUND_SPEED / (SOUND_SPEED + vRadial);
  // Clamp to safe playbackRate range to avoid weird artefacts.
  return Math.max(0.5, Math.min(2, factor));
}

function schedule(
  p: AudioParam,
  value: number,
  time: number,
  curve: CurveType,
  tension: number,
): void {
  switch (curve) {
    case 'hold':
      p.setValueAtTime(value, time);
      return;
    case 'linear':
      p.linearRampToValueAtTime(value, time);
      return;
    case 'ease-out':
      p.setTargetAtTime(value, time, 0.18);
      return;
    case 'cubic':
      // Hermite-like easing approximated via setTargetAtTime tau dependent on tension.
      p.setTargetAtTime(value, time, 0.04 + tension * 0.4);
      return;
  }
}

function generateRoomIR(ctx: AudioContext, durationSec = 1.5): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
    }
  }
  return ir;
}

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private currentKeyframes: SpatialKeyframe[] = [];
  private settings: ProjectSettings | null = null;
  private monitoring: 'binaural' | 'stereo' = 'binaural';

  // Per-play
  private source: AudioBufferSourceNode | null = null;
  private masterNode: GainNode | null = null;
  private kfGain: GainNode | null = null;
  private hpf: BiquadFilterNode | null = null;
  private lpf: BiquadFilterNode | null = null;
  private airLpf: BiquadFilterNode | null = null;
  private panner: PannerNode | null = null;
  private bypassPanner: GainNode | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;

  // Persistent
  private convolver: ConvolverNode | null = null;
  private convolverIR: AudioBuffer | null = null;
  private mixOut: GainNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;

  private startedAt = 0;
  private pausedAt = 0;
  private playing = false;
  private masterGain = 1;

  getContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return this.getContext().decodeAudioData(arrayBuffer);
  }

  setBuffer(buffer: AudioBuffer): void {
    this.stopInternal();
    this.buffer = buffer;
    this.pausedAt = 0;
    this.playing = false;
    this.ensurePersistent();
  }

  setKeyframes(keyframes: SpatialKeyframe[]): void {
    this.currentKeyframes = keyframes;
    if (this.playing) {
      this.applyKeyframeAutomation(keyframes, this.getCurrentTime());
    }
  }

  setSettings(s: ProjectSettings): void {
    this.settings = s;
    if (this.panner) {
      this.panner.panningModel = s.panningModel;
      this.panner.distanceModel = s.distanceModel;
      this.panner.refDistance = s.refDistance;
      this.panner.rolloffFactor = s.rolloffFactor;
    }
  }

  setMasterGain(linear: number): void {
    this.masterGain = linear;
    if (this.masterNode) this.masterNode.gain.value = linear;
  }

  setMonitoring(mode: 'binaural' | 'stereo'): void {
    this.monitoring = mode;
    const ctx = this.ctx;
    if (!this.panner || !this.bypassPanner || !ctx) return;
    const t = ctx.currentTime + 0.05;
    if (mode === 'binaural') {
      this.panner.connect.bind(this.panner); // no-op typing
      this.bypassPanner.gain.cancelScheduledValues(ctx.currentTime);
      this.bypassPanner.gain.linearRampToValueAtTime(0, t);
    } else {
      this.bypassPanner.gain.cancelScheduledValues(ctx.currentTime);
      this.bypassPanner.gain.linearRampToValueAtTime(1, t);
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getAnalyserL(): AnalyserNode | null {
    return this.analyserL;
  }

  getAnalyserR(): AnalyserNode | null {
    return this.analyserR;
  }

  getCpuApproxPercent(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const lat = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    if (!lat) return 0;
    return Math.min(99, lat * 100 * 1.4);
  }

  getBufferSize(): number | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const lat = (ctx as AudioContext & { baseLatency?: number }).baseLatency ?? 0;
    if (!lat) return null;
    return Math.round(lat * ctx.sampleRate);
  }

  play(offsetSec = this.pausedAt): void {
    if (!this.buffer) return;
    const ctx = this.getContext();
    if (ctx.state === 'suspended') void ctx.resume();
    this.stopInternal();

    const source = ctx.createBufferSource();
    source.buffer = this.buffer;

    const masterNode = ctx.createGain();
    masterNode.gain.value = this.masterGain;

    const kfGain = ctx.createGain();
    kfGain.gain.value = 1;

    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 0;
    hpf.Q.value = 0.7;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 22050;
    lpf.Q.value = 0.7;

    const airLpf = ctx.createBiquadFilter();
    airLpf.type = 'lowpass';
    airLpf.frequency.value = 22050;
    airLpf.Q.value = 0.7;

    const panner = ctx.createPanner();
    panner.panningModel = this.settings?.panningModel ?? 'HRTF';
    panner.distanceModel = this.settings?.distanceModel ?? 'inverse';
    panner.refDistance = this.settings?.refDistance ?? 1;
    panner.rolloffFactor = this.settings?.rolloffFactor ?? 1;
    panner.positionX.value = 0;
    panner.positionY.value = 0;
    panner.positionZ.value = -1;

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

    // Bypass path for STEREO monitoring (sums into mixOut around the panner).
    const bypassPanner = ctx.createGain();
    bypassPanner.gain.value = this.monitoring === 'stereo' ? 1 : 0;

    const dry = ctx.createGain();
    dry.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = 0;

    const { mixOut } = this.ensurePersistent();

    // source → master → kfGain → hpf → lpf → airLpf
    source.connect(masterNode).connect(kfGain).connect(hpf).connect(lpf).connect(airLpf);
    // airLpf splits into the binaural panner path AND the stereo bypass path
    airLpf.connect(panner);
    airLpf.connect(bypassPanner);
    // both feed dry + wet
    panner.connect(dry);
    panner.connect(wet);
    bypassPanner.connect(dry);
    bypassPanner.connect(wet);
    // dry → mixOut, wet → convolver → mixOut
    dry.connect(mixOut);
    if (this.convolver) {
      wet.connect(this.convolver).connect(mixOut);
    } else {
      wet.connect(mixOut);
    }

    source.start(0, offsetSec);

    this.source = source;
    this.masterNode = masterNode;
    this.kfGain = kfGain;
    this.hpf = hpf;
    this.lpf = lpf;
    this.airLpf = airLpf;
    this.panner = panner;
    this.bypassPanner = bypassPanner;
    this.dry = dry;
    this.wet = wet;
    this.startedAt = ctx.currentTime - offsetSec;
    this.playing = true;

    this.applyKeyframeAutomation(this.currentKeyframes, offsetSec);

    source.onended = () => {
      if (this.source === source && this.playing) {
        const reachedEnd = this.getCurrentTime() >= (this.buffer?.duration ?? 0) - 0.05;
        this.playing = false;
        if (reachedEnd) this.pausedAt = 0;
      }
    };
  }

  pause(): void {
    if (!this.playing) return;
    this.pausedAt = this.getCurrentTime();
    this.stopInternal();
    this.playing = false;
  }

  stop(): void {
    this.stopInternal();
    this.pausedAt = 0;
    this.playing = false;
  }

  seek(timeSec: number): void {
    const wasPlaying = this.playing;
    this.stopInternal();
    this.pausedAt = Math.max(0, Math.min(timeSec, this.buffer?.duration ?? 0));
    this.playing = false;
    if (wasPlaying) this.play(this.pausedAt);
  }

  getCurrentTime(): number {
    if (!this.playing) return this.pausedAt;
    const ctx = this.getContext();
    return Math.min(ctx.currentTime - this.startedAt, this.buffer?.duration ?? 0);
  }

  applyKeyframeAutomation(keyframes: SpatialKeyframe[], offsetSec: number): void {
    if (
      !this.panner ||
      !this.kfGain ||
      !this.hpf ||
      !this.lpf ||
      !this.airLpf ||
      !this.wet ||
      !this.ctx
    ) {
      return;
    }
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    const params: AudioParam[] = [
      this.panner.positionX,
      this.panner.positionY,
      this.panner.positionZ,
      this.kfGain.gain,
      this.hpf.frequency,
      this.lpf.frequency,
      this.airLpf.frequency,
      this.wet.gain,
    ];
    for (const p of params) p.cancelScheduledValues(t0);
    if (this.source) this.source.playbackRate.cancelScheduledValues(t0);

    if (keyframes.length === 0) return;

    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    const initial = sorted[0];
    const initialDist = distanceOf(initial.position);
    const initialDoppler = dopplerFactor(initial, sorted);

    this.panner.positionX.setValueAtTime(initial.position.x, t0);
    this.panner.positionY.setValueAtTime(initial.position.y, t0);
    this.panner.positionZ.setValueAtTime(initial.position.z, t0);
    this.kfGain.gain.setValueAtTime(gainFromDb(initial.gain), t0);
    this.hpf.frequency.setValueAtTime(initial.hpf ?? 0, t0);
    this.lpf.frequency.setValueAtTime(initial.lpf ?? 22050, t0);
    this.airLpf.frequency.setValueAtTime(airAbsorptionCutoff(initialDist, initial.airAbsorption), t0);
    const initialWet = initial.reverbSend ?? this.settings?.reverb.wet ?? 0;
    this.wet.gain.setValueAtTime(this.settings?.reverb.enabled ? initialWet : 0, t0);
    if (this.source) this.source.playbackRate.setValueAtTime(initialDoppler, t0);

    for (const kf of sorted) {
      if (kf.time < offsetSec) continue;
      const audioTime = t0 + (kf.time - offsetSec);
      const dist = distanceOf(kf.position);
      schedule(this.panner.positionX, kf.position.x, audioTime, kf.curve, kf.tension);
      schedule(this.panner.positionY, kf.position.y, audioTime, kf.curve, kf.tension);
      schedule(this.panner.positionZ, kf.position.z, audioTime, kf.curve, kf.tension);
      schedule(this.kfGain.gain, gainFromDb(kf.gain), audioTime, kf.curve, kf.tension);
      schedule(this.hpf.frequency, kf.hpf ?? 0, audioTime, kf.curve, kf.tension);
      schedule(this.lpf.frequency, kf.lpf ?? 22050, audioTime, kf.curve, kf.tension);
      schedule(
        this.airLpf.frequency,
        airAbsorptionCutoff(dist, kf.airAbsorption),
        audioTime,
        kf.curve,
        kf.tension,
      );
      const wetTarget = kf.reverbSend ?? this.settings?.reverb.wet ?? 0;
      schedule(
        this.wet.gain,
        this.settings?.reverb.enabled ? wetTarget : 0,
        audioTime,
        kf.curve,
        kf.tension,
      );
      if (this.source) {
        schedule(this.source.playbackRate, dopplerFactor(kf, sorted), audioTime, kf.curve, kf.tension);
      }
    }
  }

  private ensurePersistent(): { mixOut: GainNode } {
    const ctx = this.getContext();
    if (!this.convolver) {
      this.convolver = ctx.createConvolver();
      this.convolverIR = generateRoomIR(ctx);
      this.convolver.buffer = this.convolverIR;
    }
    if (!this.mixOut) this.mixOut = ctx.createGain();
    if (!this.splitter) this.splitter = ctx.createChannelSplitter(2);
    if (!this.analyserL) {
      this.analyserL = ctx.createAnalyser();
      this.analyserL.fftSize = 256;
      this.analyserL.smoothingTimeConstant = 0.4;
    }
    if (!this.analyserR) {
      this.analyserR = ctx.createAnalyser();
      this.analyserR.fftSize = 256;
      this.analyserR.smoothingTimeConstant = 0.4;
    }
    // Persistent wiring: mixOut → splitter → analyserL/R AND mixOut → destination.
    this.mixOut.connect(this.splitter);
    this.splitter.connect(this.analyserL, 0);
    this.splitter.connect(this.analyserR, 1);
    this.mixOut.connect(ctx.destination);
    return { mixOut: this.mixOut };
  }

  private stopInternal(): void {
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        /* déjà arrêté */
      }
      this.source.disconnect();
      this.source = null;
    }
    for (const n of [
      this.masterNode,
      this.kfGain,
      this.hpf,
      this.lpf,
      this.airLpf,
      this.panner,
      this.bypassPanner,
      this.dry,
      this.wet,
    ]) {
      if (n) n.disconnect();
    }
    this.masterNode = null;
    this.kfGain = null;
    this.hpf = null;
    this.lpf = null;
    this.airLpf = null;
    this.panner = null;
    this.bypassPanner = null;
    this.dry = null;
    this.wet = null;
  }
}

export const AudioEngine = new AudioEngineImpl();
