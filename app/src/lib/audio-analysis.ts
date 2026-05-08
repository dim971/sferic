import { analyze } from 'web-audio-beat-detector';

export async function detectBpm(buffer: AudioBuffer): Promise<number | null> {
  try {
    const tempo = await analyze(buffer);
    if (!Number.isFinite(tempo)) return null;
    return Math.round(tempo);
  } catch {
    return null;
  }
}

export interface BarBeat {
  bar: number;
  beat: number;
  sixteenth: number;
}

export function timeToBarBeat(timeSec: number, bpm: number): BarBeat {
  if (bpm <= 0 || !Number.isFinite(bpm)) return { bar: 1, beat: 1, sixteenth: 1 };
  const secPerBeat = 60 / bpm;
  const totalBeats = timeSec / secPerBeat;
  const bar = Math.floor(totalBeats / 4) + 1;
  const beat = Math.floor(totalBeats % 4) + 1;
  const sixteenth = Math.floor((totalBeats * 4) % 4) + 1;
  return { bar, beat, sixteenth };
}

export function peakToDb(peak: number): number {
  if (peak <= 0) return -Infinity;
  return 20 * Math.log10(peak);
}

export function readPeak(analyser: AnalyserNode): number {
  const arr = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(arr);
  let peak = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = Math.abs(arr[i]);
    if (v > peak) peak = v;
  }
  return peak;
}
