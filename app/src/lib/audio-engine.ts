import type { CurveType, ProjectSettings, SpatialKeyframe } from '@/types/project';
import { airAbsorptionCutoff, applyCurve } from '@/lib/math3d';

function gainFromDb(db: number): number {
  return Math.pow(10, db / 20);
}

function distanceOf(p: { x: number; y: number; z: number }): number {
  return Math.hypot(p.x, p.y, p.z);
}

const SOUND_SPEED = 343; // m/s, our world units ≈ metres

// 0 when source is at front-equator (-Z axis), 1 when fully behind, above,
// or below. Used to drive the spatial-enhancement processing so off-axis
// positions read more clearly on headphones.
function offAxisness(p: { x: number; y: number; z: number }): number {
  const r = Math.hypot(p.x, p.y, p.z);
  if (r < 1e-6) return 0;
  // Front direction is -Z. Rear factor: 0 when source faces -Z, 1 when +Z.
  const front = -p.z / r; // 1 = front, -1 = back
  const back = (1 - front) / 2;
  // Vertical factor: 0 at equator, 1 at the poles.
  const elev = Math.abs(p.y) / r;
  return Math.max(back, elev);
}

function directionalCutoff(p: { x: number; y: number; z: number }, amount: number): number {
  if (amount <= 0) return 22050;
  // 22 050 Hz at front-equator, ~2 500 Hz when fully off-axis with amount=1.
  const o = offAxisness(p);
  const cut = 22050 - o * amount * (22050 - 2500);
  return Math.max(2500, cut);
}

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

interface Segment {
  start: number;
  dur: number;
  from: number;
  to: number;
  curve: CurveType;
  tension: number;
  startRawT: number; // 0 for full segments; >0 if the playhead is mid-segment
}

const CURVE_SAMPLE_HZ = 120; // 120 samples/sec is plenty for spatial smoothing
const CURVE_MAX_SAMPLES = 4096;

function sampleSegment(s: Segment): Float32Array {
  const n = Math.max(2, Math.min(CURVE_MAX_SAMPLES, Math.ceil(s.dur * CURVE_SAMPLE_HZ)));
  const arr = new Float32Array(n);
  const span = 1 - s.startRawT;
  const delta = s.to - s.from;
  for (let i = 0; i < n; i++) {
    const local = i / (n - 1);
    const fullT = s.startRawT + local * span;
    arr[i] = s.from + delta * applyCurve(fullT, s.curve, s.tension);
  }
  return arr;
}

function scheduleSegment(p: AudioParam, s: Segment, isFirst: boolean): void {
  if (s.dur <= 0) {
    p.setValueAtTime(s.to, s.start);
    return;
  }
  const endTime = s.start + s.dur;
  switch (s.curve) {
    case 'hold': {
      // The "current" value during a hold is always s.from (until snap at endTime).
      if (isFirst) p.setValueAtTime(s.from, s.start);
      p.setValueAtTime(s.to, endTime);
      return;
    }
    case 'linear': {
      // Linear ramps need a previous event as anchor. For the very first segment,
      // we provide it explicitly; otherwise the previous segment's endpoint anchors.
      if (isFirst) {
        const startVal = s.from + (s.to - s.from) * s.startRawT; // applyCurve('linear', t) = t
        p.setValueAtTime(startVal, s.start);
      }
      p.linearRampToValueAtTime(s.to, endTime);
      return;
    }
    case 'ease-out':
    case 'cubic': {
      // Sampled curve: arr[0] is the value at s.start (interpolated mid-segment
      // when startRawT > 0), arr[N-1] is s.to. setValueCurveAtTime drives the
      // param continuously across the whole segment.
      const arr = sampleSegment(s);
      p.setValueCurveAtTime(arr, s.start, s.dur);
      return;
    }
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

interface RenderCapacityEvent {
  averageLoad?: number;
  peakLoad?: number;
}

interface RenderCapacityHandle {
  addEventListener: (type: 'update', listener: (e: RenderCapacityEvent) => void) => void;
  start: (options?: { updateInterval?: number }) => void;
}

interface AudioContextWithCapacity extends AudioContext {
  renderCapacity?: RenderCapacityHandle;
}

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private currentKeyframes: SpatialKeyframe[] = [];
  private settings: ProjectSettings | null = null;
  private monitoring: 'binaural' | 'stereo' = 'binaural';
  private renderCapacityValue = -1;

  // Per-play
  private source: AudioBufferSourceNode | null = null;
  private masterNode: GainNode | null = null;
  private kfGain: GainNode | null = null;
  private hpf: BiquadFilterNode | null = null;
  private lpf: BiquadFilterNode | null = null;
  private airLpf: BiquadFilterNode | null = null;
  private dirLpf: BiquadFilterNode | null = null;
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
  private persistentWired = false;

  private startedAt = 0;
  private pausedAt = 0;
  private playing = false;
  private masterGain = 1;

  getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const cap = (this.ctx as AudioContextWithCapacity).renderCapacity;
      if (cap && typeof cap.addEventListener === 'function') {
        cap.addEventListener('update', (e) => {
          if (typeof e.averageLoad === 'number') {
            this.renderCapacityValue = e.averageLoad * 100;
          }
        });
        try {
          cap.start({ updateInterval: 0.25 });
        } catch {
          /* not supported, fall through to heuristic */
        }
      }
    }
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
    if (this.renderCapacityValue >= 0) {
      return Math.min(99.9, this.renderCapacityValue);
    }
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

    // Directional darkening: cuts highs progressively the further the source
    // moves from front-equator (behind / above / below). Driven per-keyframe
    // by spatialEnhancement settings + position.
    const dirLpf = ctx.createBiquadFilter();
    dirLpf.type = 'lowpass';
    dirLpf.frequency.value = 22050;
    dirLpf.Q.value = 0.7;

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

    // source → master → kfGain → hpf → lpf → airLpf → dirLpf
    source.connect(masterNode).connect(kfGain).connect(hpf).connect(lpf).connect(airLpf).connect(dirLpf);
    // dirLpf splits into the binaural panner path AND the stereo bypass path
    dirLpf.connect(panner);
    dirLpf.connect(bypassPanner);
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
    this.dirLpf = dirLpf;
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
      !this.dirLpf ||
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
      this.dirLpf.frequency,
      this.wet.gain,
    ];
    for (const p of params) p.cancelScheduledValues(t0);
    if (this.source) this.source.playbackRate.cancelScheduledValues(t0);

    if (keyframes.length === 0) return;

    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    const reverbEnabled = this.settings?.reverb.enabled ?? false;
    const reverbDefaultWet = this.settings?.reverb.wet ?? 0;
    const enhEnabled = this.settings?.spatialEnhancement.enabled ?? false;
    const enhAmount = enhEnabled
      ? Math.max(0, Math.min(1, this.settings?.spatialEnhancement.amount ?? 0))
      : 0;

    const specs: Array<{ param: AudioParam; read: (kf: SpatialKeyframe) => number }> = [
      { param: this.panner.positionX, read: (kf) => kf.position.x },
      { param: this.panner.positionY, read: (kf) => kf.position.y },
      { param: this.panner.positionZ, read: (kf) => kf.position.z },
      { param: this.kfGain.gain, read: (kf) => gainFromDb(kf.gain) },
      { param: this.hpf.frequency, read: (kf) => kf.hpf ?? 0 },
      { param: this.lpf.frequency, read: (kf) => kf.lpf ?? 22050 },
      {
        param: this.airLpf.frequency,
        read: (kf) => airAbsorptionCutoff(distanceOf(kf.position), kf.airAbsorption),
      },
      {
        param: this.dirLpf.frequency,
        read: (kf) => directionalCutoff(kf.position, enhAmount),
      },
      {
        param: this.wet.gain,
        read: (kf) => {
          const base = reverbEnabled ? (kf.reverbSend ?? reverbDefaultWet) : 0;
          if (enhAmount === 0) return base;
          // Lift reverb send for off-axis sources to add a sense of "room"
          // around them. Capped at 1.0 to stay within sane mixing bounds.
          const lift = offAxisness(kf.position) * enhAmount * 0.4;
          return Math.min(1, base + lift);
        },
      },
    ];
    if (this.source) {
      specs.push({
        param: this.source.playbackRate,
        read: (kf) => dopplerFactor(kf, sorted),
      });
    }

    for (const spec of specs) {
      this.scheduleParam(spec.param, spec.read, sorted, offsetSec, t0);
    }
  }

  private scheduleParam(
    p: AudioParam,
    read: (kf: SpatialKeyframe) => number,
    sorted: SpatialKeyframe[],
    offsetSec: number,
    t0: number,
  ): void {
    if (sorted.length === 0) return;

    // Locate prev (last keyframe with time <= offsetSec) and next (first after).
    let prevIdx = -1;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].time <= offsetSec) prevIdx = i;
      else break;
    }
    const nextIdx = prevIdx + 1;

    const segments: Segment[] = [];

    if (prevIdx < 0) {
      // Playhead is before the first keyframe — hold the first keyframe's
      // value until it arrives, then play full segments.
      const first = sorted[0];
      const holdDur = first.time - offsetSec;
      if (holdDur > 0) {
        segments.push({
          start: t0,
          dur: holdDur,
          from: read(first),
          to: read(first),
          curve: 'hold',
          tension: 0,
          startRawT: 0,
        });
      }
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1];
        const b = sorted[i];
        segments.push({
          start: t0 + (a.time - offsetSec),
          dur: b.time - a.time,
          from: read(a),
          to: read(b),
          curve: b.curve,
          tension: b.tension,
          startRawT: 0,
        });
      }
    } else if (nextIdx >= sorted.length) {
      // Past the last keyframe — just hold its value, no more segments.
      p.setValueAtTime(read(sorted[prevIdx]), t0);
      return;
    } else {
      // Mid-segment: schedule a partial first segment plus full remaining ones.
      const prev = sorted[prevIdx];
      const next = sorted[nextIdx];
      const segDur = next.time - prev.time;
      const startRawT =
        segDur > 0 ? Math.max(0, Math.min(1, (offsetSec - prev.time) / segDur)) : 1;
      const remainingDur = next.time - offsetSec;
      if (remainingDur > 0) {
        segments.push({
          start: t0,
          dur: remainingDur,
          from: read(prev),
          to: read(next),
          curve: next.curve,
          tension: next.tension,
          startRawT,
        });
      } else {
        p.setValueAtTime(read(next), t0);
      }
      for (let i = nextIdx; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        segments.push({
          start: t0 + (a.time - offsetSec),
          dur: b.time - a.time,
          from: read(a),
          to: read(b),
          curve: b.curve,
          tension: b.tension,
          startRawT: 0,
        });
      }
    }

    for (let i = 0; i < segments.length; i++) {
      scheduleSegment(p, segments[i], i === 0);
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
    // Persistent wiring made ONCE — multiple connect() calls would pile up edges,
    // amplifying audio and breaking VU readings.
    if (!this.persistentWired) {
      this.mixOut.connect(this.splitter);
      this.splitter.connect(this.analyserL, 0);
      this.splitter.connect(this.analyserR, 1);
      this.mixOut.connect(ctx.destination);
      this.persistentWired = true;
    }
    return { mixOut: this.mixOut };
  }

  private stopInternal(): void {
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        /* already stopped */
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
      this.dirLpf,
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
    this.dirLpf = null;
    this.panner = null;
    this.bypassPanner = null;
    this.dry = null;
    this.wet = null;
  }
}

export const AudioEngine = new AudioEngineImpl();
