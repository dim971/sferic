import type { CurveType, ProjectSettings, SpatialKeyframe } from '@/types/project';

function schedule(
  p: AudioParam,
  value: number,
  time: number,
  curve: CurveType,
  tension: number,
): void {
  switch (curve) {
    case 'step':
      p.setValueAtTime(value, time);
      return;
    case 'linear':
      p.linearRampToValueAtTime(value, time);
      return;
    case 'eaze':
      p.setTargetAtTime(value, time, 0.25);
      return;
    case 'smooth':
      p.setTargetAtTime(value, time, 0.05 + tension * 0.4);
      return;
  }
}

function gainFromDb(db: number | undefined): number {
  return Math.pow(10, (db ?? 0) / 20);
}

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private currentKeyframes: SpatialKeyframe[] = [];

  // Per-play nodes
  private source: AudioBufferSourceNode | null = null;
  private kfGain: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private panner: PannerNode | null = null;

  // Persistent
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
    this.ensureAnalysers();
  }

  setKeyframes(keyframes: SpatialKeyframe[]): void {
    this.currentKeyframes = keyframes;
    if (this.playing) {
      this.applyKeyframeAutomation(keyframes, this.getCurrentTime());
    }
  }

  applySettings(s: ProjectSettings): void {
    if (!this.panner) return;
    this.panner.panningModel = s.panningModel;
    this.panner.distanceModel = s.distanceModel;
    this.panner.refDistance = s.refDistance;
    this.panner.rolloffFactor = s.rolloffFactor;
  }

  setMasterGain(linear: number): void {
    this.masterGain = linear;
    if (this.masterGainNode) this.masterGainNode.gain.value = linear;
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

  play(offsetSec = this.pausedAt): void {
    if (!this.buffer) return;
    const ctx = this.getContext();
    if (ctx.state === 'suspended') void ctx.resume();
    this.stopInternal();

    const source = ctx.createBufferSource();
    source.buffer = this.buffer;

    const kfGain = ctx.createGain();
    kfGain.gain.value = 1;

    const masterGainNode = ctx.createGain();
    masterGainNode.gain.value = this.masterGain;

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.rolloffFactor = 1;
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

    const { splitter } = this.ensureAnalysers();

    source.connect(kfGain).connect(masterGainNode).connect(panner).connect(ctx.destination);
    panner.connect(splitter);

    source.start(0, offsetSec);

    this.source = source;
    this.kfGain = kfGain;
    this.masterGainNode = masterGainNode;
    this.panner = panner;
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
    if (!this.panner || !this.kfGain || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    const params = [
      this.panner.positionX,
      this.panner.positionY,
      this.panner.positionZ,
      this.kfGain.gain,
    ];
    for (const p of params) p.cancelScheduledValues(t0);

    if (keyframes.length === 0) return;

    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    const initial = sorted[0];
    this.panner.positionX.setValueAtTime(initial.position.x, t0);
    this.panner.positionY.setValueAtTime(initial.position.y, t0);
    this.panner.positionZ.setValueAtTime(initial.position.z, t0);
    this.kfGain.gain.setValueAtTime(gainFromDb(initial.gainDb), t0);

    for (const kf of sorted) {
      if (kf.time < offsetSec) continue;
      const audioTime = t0 + (kf.time - offsetSec);
      const tension = kf.tension ?? 0.5;
      schedule(this.panner.positionX, kf.position.x, audioTime, kf.curve, tension);
      schedule(this.panner.positionY, kf.position.y, audioTime, kf.curve, tension);
      schedule(this.panner.positionZ, kf.position.z, audioTime, kf.curve, tension);
      schedule(this.kfGain.gain, gainFromDb(kf.gainDb), audioTime, kf.curve, tension);
    }
  }

  private ensureAnalysers(): { splitter: ChannelSplitterNode } {
    const ctx = this.getContext();
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
    this.splitter.connect(this.analyserL, 0);
    this.splitter.connect(this.analyserR, 1);
    return { splitter: this.splitter };
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
    if (this.kfGain) {
      this.kfGain.disconnect();
      this.kfGain = null;
    }
    if (this.masterGainNode) {
      this.masterGainNode.disconnect();
      this.masterGainNode = null;
    }
    if (this.panner) {
      this.panner.disconnect();
      this.panner = null;
    }
  }
}

export const AudioEngine = new AudioEngineImpl();
