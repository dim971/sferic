import { useEffect } from 'react';
import { useProjectStore } from '@/store/project-store';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const state = useProjectStore.getState();

      if (e.code === 'Space') {
        e.preventDefault();
        if (state.playback.isPlaying) state.pause();
        else state.play();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedKeyframeId) {
          e.preventDefault();
          state.removeKeyframe(state.selectedKeyframeId);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (state.selectedKeyframeId) {
          e.preventDefault();
          state.selectKeyframe(null);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // Phase 7 will implement save; hook placeholder.
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
