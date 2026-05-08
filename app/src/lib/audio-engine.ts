import type { ProjectSettings } from '@/types/project';

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private panner: PannerNode | null = null;
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
    if (this.gain) this.gain.gain.value = linear;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  play(offsetSec = this.pausedAt): void {
    if (!this.buffer) return;
    const ctx = this.getContext();
    if (ctx.state === 'suspended') void ctx.resume();
    this.stopInternal();

    const source = ctx.createBufferSource();
    source.buffer = this.buffer;

    const gain = ctx.createGain();
    gain.gain.value = this.masterGain;

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

    source.connect(gain).connect(panner).connect(ctx.destination);
    source.start(0, offsetSec);

    this.source = source;
    this.gain = gain;
    this.panner = panner;
    this.startedAt = ctx.currentTime - offsetSec;
    this.playing = true;

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
    if (this.gain) {
      this.gain.disconnect();
      this.gain = null;
    }
    if (this.panner) {
      this.panner.disconnect();
      this.panner = null;
    }
  }
}

export const AudioEngine = new AudioEngineImpl();
