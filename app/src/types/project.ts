export type CurveType = 'linear' | 'eaze' | 'smooth' | 'step';

export interface SpatialKeyframe {
  id: string;
  time: number;
  position: { x: number; y: number; z: number };
  curve: CurveType;
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

export interface ProjectSettings {
  panningModel: 'HRTF' | 'equalpower';
  distanceModel: 'linear' | 'inverse' | 'exponential';
  refDistance: number;
  rolloffFactor: number;
  reverb: { enabled: boolean; wet: number };
  snapToSphere: boolean;
  doppler: { enabled: boolean; intensity: number };
}

export interface AudioFileMeta {
  originalPath: string;
  embeddedSampleRate: number;
  durationSec: number;
  channels: number;
}

export interface Project {
  version: 1;
  audioFile: AudioFileMeta;
  keyframes: SpatialKeyframe[];
  settings: ProjectSettings;
  meta: { createdAt: string; updatedAt: string; name: string };
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  panningModel: 'HRTF',
  distanceModel: 'inverse',
  refDistance: 1,
  rolloffFactor: 1,
  reverb: { enabled: false, wet: 0.3 },
  snapToSphere: true,
  doppler: { enabled: false, intensity: 0.5 },
};
