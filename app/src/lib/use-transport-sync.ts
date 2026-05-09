import { useEffect } from 'react';
import { useProjectStore } from '@/store/project-store';
import { AudioEngine } from '@/lib/audio-engine';

export function useTransportSync(): void {
  const isPlaying = useProjectStore((s) => s.playback.isPlaying);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const now = AudioEngine.getCurrentTime();
      setCurrentTime(now);
      // Loop wrap: if enabled and we passed loopEnd, seek back to loopStart.
      const state = useProjectStore.getState();
      if (state.loopEnabled && state.loopRegion) {
        const { start, end } = state.loopRegion;
        if (now >= end - 0.005 && end > start) {
          state.seek(start);
        }
      }
      if (!AudioEngine.isPlaying()) {
        setIsPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, setCurrentTime, setIsPlaying]);
}
