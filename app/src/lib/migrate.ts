import type { CurveType, Project, SpatialKeyframe } from '@/types/project';

interface ProjectV1Keyframe {
  id: string;
  time: number;
  position: { x: number; y: number; z: number };
  curve: string;
  label?: string;
  duration?: number;
  tension?: number;
  gainDb?: number;
  snap?: boolean;
  hpfHz?: number;
  lpfHz?: number;
  doppler?: boolean;
  velocity?: boolean;
  dopplerIntensity?: number;
}

interface ProjectV1 {
  version: 1;
  audioFile: Project['audioFile'];
  keyframes: ProjectV1Keyframe[];
  settings: Project['settings'];
  meta: Project['meta'];
}

export function migrateProject(raw: unknown): Project {
  const obj = raw as { version?: number };
  if (obj.version === 2) return raw as Project;
  if (obj.version === 1) {
    const v1 = raw as ProjectV1;
    return {
      version: 2,
      audioFile: v1.audioFile,
      settings: v1.settings,
      meta: v1.meta,
      audioMeta: { bpm: null, key: null },
      keyframes: v1.keyframes.map(migrateKeyframe),
    };
  }
  throw new Error(`Unknown project version: ${obj.version}`);
}

function migrateKeyframe(kf: ProjectV1Keyframe): SpatialKeyframe {
  return {
    id: kf.id,
    time: kf.time,
    position: kf.position,
    curve: mapCurveV1(kf.curve),
    tension: kf.tension ?? 0.5,
    gain: kf.gainDb ?? 0,
    lpf: kf.lpfHz ?? null,
    hpf: kf.hpfHz ?? null,
    doppler: kf.doppler ?? true,
    airAbsorption: 0.18,
    reverbSend: null,
    label: kf.label,
    snap: kf.snap,
  };
}

function mapCurveV1(c: string): CurveType {
  if (c === 'step') return 'hold';
  if (c === 'eaze' || c === 'easeIn' || c === 'easeOut' || c === 'easeInOut') return 'ease-out';
  if (c === 'smooth') return 'cubic';
  return 'linear';
}
