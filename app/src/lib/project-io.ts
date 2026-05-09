import { open, save } from '@tauri-apps/plugin-dialog';
import { exists, readFile, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { migrateProject } from '@/lib/migrate';
import { AudioEngine } from '@/lib/audio-engine';
import type { Project } from '@/types/project';

export async function readAudioBytes(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Best-effort source bit-depth detection. Reads the WAV `fmt ` chunk if present.
 * Returns null for non-WAV files (we have no header parser for MP3/FLAC/etc).
 */
export function detectWavBitDepth(arrayBuffer: ArrayBuffer): number | null {
  if (arrayBuffer.byteLength < 44) return null;
  const view = new DataView(arrayBuffer);
  // RIFF .... WAVE
  if (view.getUint32(0, false) !== 0x52494646) return null;
  if (view.getUint32(8, false) !== 0x57415645) return null;
  // bit depth at offset 34, little-endian uint16 (per WAV spec)
  return view.getUint16(34, true);
}

// Tauri 2 dialog filters on macOS have several edge cases (multi-part
// extensions, AllowedFileTypes interactions, plugin version mismatches) that
// can silently cause file selection to be blocked. The only fully reliable
// behaviour is to pass NO filter at all. Type detection happens after the
// user has picked.
const PROJECT_FULL_SUFFIX = '.spatialize.json';
const PROJECT_DEFAULT_EXT = 'spatialize.json';
const AUDIO_EXTS = ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'];

export async function pickProjectPathToOpen(): Promise<string | null> {
  const picked = await open({ multiple: false });
  return typeof picked === 'string' ? picked : null;
}

export async function pickProjectPathToSave(defaultName: string): Promise<string | null> {
  // Save dialog needs a default extension hint so the user gets the right
  // suffix appended. Filter kept here because save filters don't gray
  // anything out on macOS (the user types the name).
  return save({ defaultPath: `${defaultName}.${PROJECT_DEFAULT_EXT}` });
}

export async function pickAudioPath(title = 'Locate audio file'): Promise<string | null> {
  const picked = await open({ title, multiple: false });
  return typeof picked === 'string' ? picked : null;
}

export async function pickAnyPath(): Promise<string | null> {
  const picked = await open({ multiple: false });
  return typeof picked === 'string' ? picked : null;
}

export function isProjectPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(PROJECT_FULL_SUFFIX) || lower.endsWith('.json');
}

export function isAudioPath(path: string): boolean {
  const lower = path.toLowerCase();
  return AUDIO_EXTS.some((ext) => lower.endsWith(`.${ext}`));
}

export async function saveProjectFile(path: string, project: Project): Promise<Project> {
  const stamped: Project = {
    ...project,
    meta: { ...project.meta, updatedAt: new Date().toISOString() },
  };
  await writeTextFile(path, JSON.stringify(stamped, null, 2));
  return stamped;
}

export async function loadProjectFile(
  path: string,
): Promise<{ project: Project; audioBuffer: AudioBuffer }> {
  const text = await readTextFile(path);
  const raw: unknown = JSON.parse(text);
  const project = migrateProject(raw);

  let audioPath = project.audioFile.originalPath;
  let audioOk = false;
  try {
    audioOk = await exists(audioPath);
  } catch {
    audioOk = false;
  }
  if (!audioOk) {
    const picked = await pickAudioPath('Localiser le fichier audio');
    if (!picked) throw new Error('Fichier audio introuvable');
    audioPath = picked;
    project.audioFile.originalPath = audioPath;
  }

  const bytes = await readFile(audioPath);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const audioBuffer = await AudioEngine.decode(arrayBuffer);

  return { project, audioBuffer };
}
