import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  Project,
  Projection,
  SpatialKeyframe,
  ViewMode,
  ViewState,
  AudioMeta,
} from '@/types/project';
import { DEFAULT_KF_AUDIO, DEFAULT_SETTINGS, DEFAULT_VIEW_STATES } from '@/types/project';
import { AudioEngine } from '@/lib/audio-engine';
import { detectBpm } from '@/lib/audio-analysis';
import {
  loadProjectFile,
  pickAudioPath,
  pickProjectPathToOpen,
  pickProjectPathToSave,
  readAudioBytes,
  saveProjectFile,
} from '@/lib/project-io';
import { interpolatePosition, type Vec3 } from '@/lib/math3d';

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
}

interface ProjectStore {
  project: Project | null;
  projectPath: string | null;
  isDirty: boolean;
  audioBuffer: AudioBuffer | null;
  selectedKeyframeId: string | null;
  playback: PlaybackState;
  masterGain: number;
  monitoring: 'binaural' | 'stereo';
  orbitEnabled: boolean;
  viewStates: Record<Projection, ViewState>;
  snapAngleDeg: number;
  viewMode: ViewMode;

  loadAudioFile: (path: string, arrayBuffer: ArrayBuffer) => Promise<void>;
  setLoadedProject: (project: Project, path: string | null, audioBuffer: AudioBuffer) => void;
  setAudioMeta: (partial: Partial<AudioMeta>) => void;

  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSec: number) => void;
  setCurrentTime: (timeSec: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setMasterGain: (linear: number) => void;
  setMonitoring: (mode: 'binaural' | 'stereo') => void;

  addKeyframe: (position: Vec3, time?: number) => string;
  insertKeyframeAtCurrent: () => string | null;
  updateKeyframe: (id: string, partial: Partial<SpatialKeyframe>) => void;
  removeKeyframe: (id: string) => void;
  selectKeyframe: (id: string | null) => void;
  updateSettings: (partial: Partial<Project['settings']>) => void;
  setOrbitEnabled: (enabled: boolean) => void;
  setViewState: (which: Projection, partial: Partial<ViewState>) => void;
  setSnapAngle: (deg: number) => void;
  setViewMode: (mode: ViewMode) => void;
  addKeyframeAtProjection: (proj: Projection, u: number, v: number) => void;
  moveKeyframe: (id: string, proj: Projection, u: number, v: number) => void;

  markDirty: () => void;
  markClean: () => void;

  saveCurrentProject: () => Promise<boolean>;
  saveCurrentProjectAs: () => Promise<boolean>;
  openProjectFromDialog: () => Promise<boolean>;
  loadAudioFromDialog: () => Promise<boolean>;

  renderModalOpen: boolean;
  shortcutsOpen: boolean;
  setRenderModalOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
}

function inferName(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function projectedToWorld(proj: Projection, u: number, v: number, fixed: Vec3): Vec3 {
  if (proj === 'top') return { x: u, y: fixed.y, z: v };
  return { x: fixed.x, y: -v, z: u };
}

function snapToSphereIfNeeded(p: Vec3, snapToSphere: boolean): Vec3 {
  if (!snapToSphere) return p;
  const len = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: p.x / len, y: p.y / len, z: p.z / len };
}

function makeKeyframe(time: number, position: Vec3, inherit?: SpatialKeyframe): SpatialKeyframe {
  const base = inherit
    ? {
        curve: inherit.curve,
        tension: inherit.tension,
        gain: inherit.gain,
        lpf: inherit.lpf,
        hpf: inherit.hpf,
        doppler: inherit.doppler,
        airAbsorption: inherit.airAbsorption,
        reverbSend: inherit.reverbSend,
      }
    : { ...DEFAULT_KF_AUDIO };
  return {
    id: nanoid(10),
    time,
    position,
    ...base,
  };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  projectPath: null,
  isDirty: false,
  audioBuffer: null,
  selectedKeyframeId: null,
  playback: { isPlaying: false, currentTime: 0 },
  masterGain: 1,
  monitoring: 'binaural',
  orbitEnabled: true,
  viewStates: DEFAULT_VIEW_STATES,
  snapAngleDeg: 0,
  viewMode: '2d',
  renderModalOpen: false,
  shortcutsOpen: false,

  loadAudioFile: async (path, arrayBuffer) => {
    const buffer = await AudioEngine.decode(arrayBuffer);
    AudioEngine.setBuffer(buffer);
    AudioEngine.setMasterGain(get().masterGain);
    AudioEngine.setKeyframes([]);
    AudioEngine.setSettings(DEFAULT_SETTINGS);
    const now = new Date().toISOString();
    const project: Project = {
      version: 2,
      audioFile: {
        originalPath: path,
        embeddedSampleRate: buffer.sampleRate,
        durationSec: buffer.duration,
        channels: buffer.numberOfChannels,
      },
      keyframes: [],
      settings: DEFAULT_SETTINGS,
      audioMeta: { bpm: null, key: null },
      meta: { createdAt: now, updatedAt: now, name: inferName(path) },
    };
    set({
      project,
      projectPath: null,
      isDirty: false,
      audioBuffer: buffer,
      selectedKeyframeId: null,
      playback: { isPlaying: false, currentTime: 0 },
    });
    void detectBpm(buffer).then((bpm) => {
      if (bpm === null) return;
      const cur = get().project;
      if (!cur || cur.audioFile.originalPath !== path) return;
      get().setAudioMeta({ bpm });
    });
  },

  setLoadedProject: (project, path, audioBuffer) => {
    AudioEngine.setBuffer(audioBuffer);
    AudioEngine.setMasterGain(get().masterGain);
    AudioEngine.setSettings(project.settings);
    AudioEngine.setKeyframes(project.keyframes);
    set({
      project,
      projectPath: path,
      isDirty: false,
      audioBuffer,
      selectedKeyframeId: null,
      playback: { isPlaying: false, currentTime: 0 },
    });
  },

  setAudioMeta: (partial) => {
    const project = get().project;
    if (!project) return;
    set({
      project: { ...project, audioMeta: { ...project.audioMeta, ...partial } },
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

  setMonitoring: (mode) => {
    AudioEngine.setMonitoring(mode);
    set({ monitoring: mode });
  },

  addKeyframe: (position, time) => {
    const state = get();
    const project = state.project;
    if (!project) return '';
    const t = time ?? state.playback.currentTime;
    const sorted = [...project.keyframes].sort((a, b) => a.time - b.time);
    const inherit = sorted.filter((k) => k.time <= t).pop();
    const kf = makeKeyframe(t, position, inherit);
    if (project.settings.snapToSphere) kf.snap = true;
    const keyframes = [...project.keyframes, kf].sort((a, b) => a.time - b.time);
    AudioEngine.setKeyframes(keyframes);
    set({
      project: {
        ...project,
        keyframes,
        meta: { ...project.meta, updatedAt: new Date().toISOString() },
      },
      isDirty: true,
      selectedKeyframeId: kf.id,
    });
    return kf.id;
  },

  insertKeyframeAtCurrent: () => {
    const state = get();
    const project = state.project;
    if (!project || !state.audioBuffer) return null;
    const t = state.playback.currentTime;
    const pos = interpolatePosition(project.keyframes, t);
    return state.addKeyframe(pos, t);
  },

  updateKeyframe: (id, partial) => {
    const project = get().project;
    if (!project) return;
    const keyframes = project.keyframes
      .map((k) => (k.id === id ? { ...k, ...partial } : k))
      .sort((a, b) => a.time - b.time);
    AudioEngine.setKeyframes(keyframes);
    set({
      project: {
        ...project,
        keyframes,
        meta: { ...project.meta, updatedAt: new Date().toISOString() },
      },
      isDirty: true,
    });
  },

  removeKeyframe: (id) => {
    const state = get();
    const project = state.project;
    if (!project) return;
    const keyframes = project.keyframes.filter((k) => k.id !== id);
    AudioEngine.setKeyframes(keyframes);
    set({
      project: {
        ...project,
        keyframes,
        meta: { ...project.meta, updatedAt: new Date().toISOString() },
      },
      isDirty: true,
      selectedKeyframeId: state.selectedKeyframeId === id ? null : state.selectedKeyframeId,
    });
  },

  selectKeyframe: (id) => set({ selectedKeyframeId: id }),

  updateSettings: (partial) => {
    const project = get().project;
    if (!project) return;
    const next = { ...project.settings, ...partial };
    AudioEngine.setSettings(next);
    set({
      project: {
        ...project,
        settings: next,
        meta: { ...project.meta, updatedAt: new Date().toISOString() },
      },
      isDirty: true,
    });
  },

  setOrbitEnabled: (enabled) => set({ orbitEnabled: enabled }),

  setViewState: (which, partial) =>
    set((s) => ({
      viewStates: { ...s.viewStates, [which]: { ...s.viewStates[which], ...partial } },
    })),

  setSnapAngle: (deg) => set({ snapAngleDeg: deg }),

  setViewMode: (mode) => set({ viewMode: mode }),

  addKeyframeAtProjection: (proj, u, v) => {
    const state = get();
    const project = state.project;
    if (!project) return;
    const t = state.playback.currentTime;
    const fixed = interpolatePosition(project.keyframes, t);
    let pos = projectedToWorld(proj, u, v, fixed);
    pos = snapToSphereIfNeeded(pos, project.settings.snapToSphere);
    state.addKeyframe(pos, t);
  },

  moveKeyframe: (id, proj, u, v) => {
    const project = get().project;
    if (!project) return;
    const kf = project.keyframes.find((k) => k.id === id);
    if (!kf) return;
    let pos = projectedToWorld(proj, u, v, kf.position);
    pos = snapToSphereIfNeeded(pos, project.settings.snapToSphere || (kf.snap ?? false));
    get().updateKeyframe(id, { position: pos });
  },

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  saveCurrentProject: async () => {
    const state = get();
    const project = state.project;
    if (!project) return false;
    let path = state.projectPath;
    if (!path) {
      path = await pickProjectPathToSave(project.meta.name || 'project');
      if (!path) return false;
    }
    const stamped = await saveProjectFile(path, project);
    set({ project: stamped, projectPath: path, isDirty: false });
    return true;
  },

  saveCurrentProjectAs: async () => {
    const state = get();
    const project = state.project;
    if (!project) return false;
    const path = await pickProjectPathToSave(project.meta.name || 'project');
    if (!path) return false;
    const stamped = await saveProjectFile(path, project);
    set({ project: stamped, projectPath: path, isDirty: false });
    return true;
  },

  openProjectFromDialog: async () => {
    const path = await pickProjectPathToOpen();
    if (!path) return false;
    const { project, audioBuffer } = await loadProjectFile(path);
    get().setLoadedProject(project, path, audioBuffer);
    return true;
  },

  loadAudioFromDialog: async () => {
    const path = await pickAudioPath('Open audio file');
    if (!path) return false;
    const arrayBuffer = await readAudioBytes(path);
    await get().loadAudioFile(path, arrayBuffer);
    return true;
  },

  setRenderModalOpen: (open) => set({ renderModalOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
}));
