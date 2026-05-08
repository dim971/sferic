import type { CurveType, Project, SpatialKeyframe } from '@/types/project';
import { airAbsorptionCutoff } from '@/lib/math3d';

function gainFromDb(db: number): number {
  return Math.pow(10, db / 20);
}

function distanceOf(p: { x: number; y: number; z: number }): number {
  return Math.hypot(p.x, p.y, p.z);
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
      p.setTargetAtTime(value, time, 0.04 + tension * 0.4);
      return;
  }
}

function generateRoomIR(ctx: OfflineAudioContext, durationSec = 1.5): AudioBuffer {
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

export interface RenderProgress {
  rendered: AudioBuffer;
}

export async function renderProject(
  project: Project,
  sourceBuffer: AudioBuffer,
): Promise<AudioBuffer> {
  const sampleRate = sourceBuffer.sampleRate;
  const length = Math.ceil(sourceBuffer.duration * sampleRate);
  const offline = new OfflineAudioContext({ numberOfChannels: 2, length, sampleRate });

  const source = offline.createBufferSource();
  source.buffer = sourceBuffer;

  const master = offline.createGain();
  master.gain.value = 1;
  const kfGain = offline.createGain();
  kfGain.gain.value = 1;
  const hpf = offline.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 0;
  hpf.Q.value = 0.7;
  const lpf = offline.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 22050;
  lpf.Q.value = 0.7;
  const airLpf = offline.createBiquadFilter();
  airLpf.type = 'lowpass';
  airLpf.frequency.value = 22050;
  airLpf.Q.value = 0.7;

  const panner = offline.createPanner();
  panner.panningModel = project.settings.panningModel;
  panner.distanceModel = project.settings.distanceModel;
  panner.refDistance = project.settings.refDistance;
  panner.rolloffFactor = project.settings.rolloffFactor;
  panner.positionX.value = 0;
  panner.positionY.value = 0;
  panner.positionZ.value = -1;

  const listener = offline.listener;
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

  const dry = offline.createGain();
  dry.gain.value = 1;
  const wet = offline.createGain();
  wet.gain.value = 0;
  const conv = offline.createConvolver();
  conv.buffer = generateRoomIR(offline);

  source
    .connect(master)
    .connect(kfGain)
    .connect(hpf)
    .connect(lpf)
    .connect(airLpf)
    .connect(panner);
  panner.connect(dry).connect(offline.destination);
  panner.connect(wet).connect(conv).connect(offline.destination);

  programmeAutomation({
    keyframes: project.keyframes,
    panner,
    kfGain,
    hpf,
    lpf,
    airLpf,
    wet,
    reverbEnabled: project.settings.reverb.enabled,
    reverbDefaultWet: project.settings.reverb.wet,
  });

  source.start(0);
  return offline.startRendering();
}

interface AutomationParams {
  keyframes: SpatialKeyframe[];
  panner: PannerNode;
  kfGain: GainNode;
  hpf: BiquadFilterNode;
  lpf: BiquadFilterNode;
  airLpf: BiquadFilterNode;
  wet: GainNode;
  reverbEnabled: boolean;
  reverbDefaultWet: number;
}

function programmeAutomation(p: AutomationParams): void {
  if (p.keyframes.length === 0) return;
  const sorted = [...p.keyframes].sort((a, b) => a.time - b.time);
  const initial = sorted[0];
  const initialDist = distanceOf(initial.position);

  p.panner.positionX.setValueAtTime(initial.position.x, 0);
  p.panner.positionY.setValueAtTime(initial.position.y, 0);
  p.panner.positionZ.setValueAtTime(initial.position.z, 0);
  p.kfGain.gain.setValueAtTime(gainFromDb(initial.gain), 0);
  p.hpf.frequency.setValueAtTime(initial.hpf ?? 0, 0);
  p.lpf.frequency.setValueAtTime(initial.lpf ?? 22050, 0);
  p.airLpf.frequency.setValueAtTime(
    airAbsorptionCutoff(initialDist, initial.airAbsorption),
    0,
  );
  const initialWet = initial.reverbSend ?? p.reverbDefaultWet;
  p.wet.gain.setValueAtTime(p.reverbEnabled ? initialWet : 0, 0);

  for (const kf of sorted) {
    const t = kf.time;
    const dist = distanceOf(kf.position);
    schedule(p.panner.positionX, kf.position.x, t, kf.curve, kf.tension);
    schedule(p.panner.positionY, kf.position.y, t, kf.curve, kf.tension);
    schedule(p.panner.positionZ, kf.position.z, t, kf.curve, kf.tension);
    schedule(p.kfGain.gain, gainFromDb(kf.gain), t, kf.curve, kf.tension);
    schedule(p.hpf.frequency, kf.hpf ?? 0, t, kf.curve, kf.tension);
    schedule(p.lpf.frequency, kf.lpf ?? 22050, t, kf.curve, kf.tension);
    schedule(
      p.airLpf.frequency,
      airAbsorptionCutoff(dist, kf.airAbsorption),
      t,
      kf.curve,
      kf.tension,
    );
    const wetTarget = kf.reverbSend ?? p.reverbDefaultWet;
    schedule(p.wet.gain, p.reverbEnabled ? wetTarget : 0, t, kf.curve, kf.tension);
  }
}
