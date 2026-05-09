export type CurveType = 'hold' | 'linear' | 'ease-out' | 'cubic';

export interface SpatialKeyframe {
  id: string;
  time: number;
  position: { x: number; y: number; z: number };
  curve: CurveType;
  tension: number;
  gain: number;
  lpf: number | null;
  hpf: number | null;
  doppler: boolean;
  airAbsorption: number;
  reverbSend: number | null;
  label?: string;
  snap?: boolean;
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
  sourceBitDepth?: number | null;
}

export interface AudioMeta {
  bpm: number | null;
  key: string | null;
}

export interface Project {
  version: 2;
  audioFile: AudioFileMeta;
  keyframes: SpatialKeyframe[];
  settings: ProjectSettings;
  audioMeta: AudioMeta;
  meta: { createdAt: string; updatedAt: string; name: string };
}

export type Projection = 'top' | 'side';

export type ViewMode = '2d' | '3d';

export interface ViewState {
  zoom: number;
  locked: boolean;
}

export const DEFAULT_VIEW_STATES: Record<Projection, ViewState> = {
  top: { zoom: 1, locked: false },
  side: { zoom: 1, locked: false },
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  panningModel: 'HRTF',
  distanceModel: 'inverse',
  refDistance: 1,
  rolloffFactor: 1,
  reverb: { enabled: false, wet: 0.3 },
  snapToSphere: true,
  doppler: { enabled: false, intensity: 0.5 },
};

export const DEFAULT_KF_AUDIO = {
  curve: 'linear' as CurveType,
  tension: 0.5,
  gain: 0,
  lpf: null,
  hpf: null,
  doppler: true,
  airAbsorption: 0.18,
  reverbSend: null,
} as const;
