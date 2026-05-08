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

  loadAudioFile: (path: string, arrayBuffer: ArrayBuffer) => Promise<void>;
}

function inferName(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  audioBuffer: null,
  selectedKeyframeId: null,
  playback: { isPlaying: false, currentTime: 0 },

  loadAudioFile: async (path, arrayBuffer) => {
    const buffer = await AudioEngine.decode(arrayBuffer);
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
}));
