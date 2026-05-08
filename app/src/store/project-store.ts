import { create } from 'zustand';
import type { Project } from '@/types/project';
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

  loadAudioFile: (path: string, arrayBuffer: ArrayBuffer) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSec: number) => void;
  setCurrentTime: (timeSec: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setMasterGain: (linear: number) => void;
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
}));
