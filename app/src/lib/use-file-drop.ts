import { useEffect, useState } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useProjectStore } from '@/store/project-store';
import { isAudioPath, isProjectPath, loadProjectFile, readAudioBytes } from '@/lib/project-io';

export function useFileDrop(): { dragOver: boolean } {
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const ready = getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setDragOver(true);
        return;
      }
      if (event.payload.type === 'leave') {
        setDragOver(false);
        return;
      }
      if (event.payload.type === 'drop') {
        setDragOver(false);
        const path = event.payload.paths[0];
        if (!path) return;
        const state = useProjectStore.getState();
        try {
          if (isProjectPath(path)) {
            const { project, audioBuffer } = await loadProjectFile(path);
            state.setLoadedProject(project, path, audioBuffer);
          } else if (isAudioPath(path)) {
            const arrayBuffer = await readAudioBytes(path);
            await state.loadAudioFile(path, arrayBuffer);
          }
        } catch (e) {
          console.error('Drop load failed', e);
        }
      }
    });
    void ready.then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  return { dragOver };
}
