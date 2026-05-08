import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Project, SpatialKeyframe } from '@/types/project';
import { DEFAULT_SETTINGS } from '@/types/project';
import { AudioEngine } from '@/lib/audio-engine';

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
}

interface ProjectStore {
  project: Project | null;
  audioBuffer: AudioBuffer | null;
  selectedKeyframeId: string | null;
  playback: PlaybackState;
  masterGain: number;
  orbitEnabled: boolean;

  loadAudioFile: (path: string, arrayBuffer: ArrayBuffer) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSec: number) => void;
  setCurrentTime: (timeSec: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setMasterGain: (linear: number) => void;

  addKeyframe: (position: { x: number; y: number; z: number }, time?: number) => string;
  updateKeyframe: (id: string, partial: Partial<SpatialKeyframe>) => void;
  removeKeyframe: (id: string) => void;
  selectKeyframe: (id: string | null) => void;
  setOrbitEnabled: (enabled: boolean) => void;
}

function inferName(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  audioBuffer: null,
  selectedKeyframeId: null,
  playback: { isPlaying: false, currentTime: 0 },
  masterGain: 1,
  orbitEnabled: true,

  loadAudioFile: async (path, arrayBuffer) => {
    const buffer = await AudioEngine.decode(arrayBuffer);
    AudioEngine.setBuffer(buffer);
    AudioEngine.setMasterGain(get().masterGain);
    const now = new Date().toISOString();
    const project: Project = {
      version: 1,
      audioFile: {
        originalPath: path,
        embeddedSampleRate: buffer.sampleRate,
        durationSec: buffer.duration,
        channels: buffer.numberOfChannels,
      },
      keyframes: [],
      settings: DEFAULT_SETTINGS,
      meta: { createdAt: now, updatedAt: now, name: inferName(path) },
    };
    set({
      project,
      audioBuffer: buffer,
      selectedKeyframeId: null,
      playback: { isPlaying: false, currentTime: 0 },
    });
  },

  play: () => {
    if (!get().audioBuffer) return;
    AudioEngine.play();
    set({ playback: { isPlaying: true, currentTime: AudioEngine.getCurrentTime() } });
  },

  pause: () => {
    AudioEngine.pause();
    set({ playback: { isPlaying: false, currentTime: AudioEngine.getCurrentTime() } });
  },

  stop: () => {
    AudioEngine.stop();
    set({ playback: { isPlaying: false, currentTime: 0 } });
  },

  seek: (timeSec) => {
    AudioEngine.seek(timeSec);
    set({
      playback: {
        isPlaying: AudioEngine.isPlaying(),
        currentTime: AudioEngine.getCurrentTime(),
      },
    });
  },

  setCurrentTime: (timeSec) => set((s) => ({ playback: { ...s.playback, currentTime: timeSec } })),

  setIsPlaying: (isPlaying) => set((s) => ({ playback: { ...s.playback, isPlaying } })),

  setMasterGain: (linear) => {
    AudioEngine.setMasterGain(linear);
    set({ masterGain: linear });
  },

  addKeyframe: (position, time) => {
    const state = get();
    const project = state.project;
    if (!project) return '';
    const t = time ?? state.playback.currentTime;
    const id = nanoid(10);
    const kf: SpatialKeyframe = {
      id,
      time: t,
      position,
      curve: 'linear',
      snap: project.settings.snapToSphere,
    };
    const keyframes = [...project.keyframes, kf].sort((a, b) => a.time - b.time);
    set({
      project: { ...project, keyframes, meta: { ...project.meta, updatedAt: new Date().toISOString() } },
      selectedKeyframeId: id,
    });
    return id;
  },

  updateKeyframe: (id, partial) => {
    const project = get().project;
    if (!project) return;
    const keyframes = project.keyframes
      .map((k) => (k.id === id ? { ...k, ...partial } : k))
      .sort((a, b) => a.time - b.time);
    set({
      project: { ...project, keyframes, meta: { ...project.meta, updatedAt: new Date().toISOString() } },
    });
  },

  removeKeyframe: (id) => {
    const state = get();
    const project = state.project;
    if (!project) return;
    const keyframes = project.keyframes.filter((k) => k.id !== id);
    set({
      project: { ...project, keyframes, meta: { ...project.meta, updatedAt: new Date().toISOString() } },
      selectedKeyframeId: state.selectedKeyframeId === id ? null : state.selectedKeyframeId,
    });
  },

  selectKeyframe: (id) => set({ selectedKeyframeId: id }),

  setOrbitEnabled: (enabled) => set({ orbitEnabled: enabled }),
}));
