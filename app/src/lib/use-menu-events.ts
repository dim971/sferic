import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '@/store/project-store';

export function useMenuEvents(): void {
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    const ready = listen<string>('menu', (event) => {
      const id = event.payload;
      const state = useProjectStore.getState();
      switch (id) {
        case 'undo':
          state.undo();
          return;
        case 'redo':
          state.redo();
          return;
        case 'open_audio':
          void state.loadAudioFromDialog();
          return;
        case 'open_project':
          void state.openAnyFromDialog();
          return;
        case 'save':
          void state.saveCurrentProject();
          return;
        case 'save_as':
          void state.saveCurrentProjectAs();
          return;
        case 'render':
          state.setRenderModalOpen(true);
          return;
        case 'insert_kf':
          state.insertKeyframeAtCurrent();
          return;
        case 'delete_kf':
          if (state.selectedKeyframeId) state.removeKeyframe(state.selectedKeyframeId);
          return;
        case 'deselect':
          state.selectKeyframe(null);
          return;
        case 'toggle_monitoring':
          state.setMonitoring(state.monitoring === 'binaural' ? 'stereo' : 'binaural');
          return;
        case 'shortcuts':
          state.setShortcutsOpen(true);
          return;
      }
    });
    void ready.then((u) => {
      unlistenFn = u;
    });
    return () => {
      unlistenFn?.();
    };
  }, []);
}
