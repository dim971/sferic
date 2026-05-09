import { open, save } from '@tauri-apps/plugin-dialog';
import { exists, readFile, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { migrateProject } from '@/lib/migrate';
import { AudioEngine } from '@/lib/audio-engine';
import type { Project } from '@/types/project';

export async function readAudioBytes(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

const PROJECT_EXT = 'spatialize.json';

export async function pickProjectPathToOpen(): Promise<string | null> {
  const picked = await open({
    multiple: false,
    filters: [{ name: 'Spatialize project', extensions: [PROJECT_EXT, 'json'] }],
  });
  return typeof picked === 'string' ? picked : null;
}

export async function pickProjectPathToSave(defaultName: string): Promise<string | null> {
  return save({
    defaultPath: `${defaultName}.${PROJECT_EXT}`,
    filters: [{ name: 'Spatialize project', extensions: [PROJECT_EXT, 'json'] }],
  });
}

export async function pickAudioPath(title = 'Localiser le fichier audio'): Promise<string | null> {
  const picked = await open({
    title,
    multiple: false,
    filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'] }],
  });
  return typeof picked === 'string' ? picked : null;
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
