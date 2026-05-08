import { useProjectStore } from '@/store/project-store';
import { timeToBarBeat } from '@/lib/audio-analysis';

export function BarBeatDisplay() {
  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const bpm = project?.audioMeta.bpm ?? null;

  if (bpm === null) return null;
  const { bar, beat, sixteenth } = timeToBarBeat(currentTime, bpm);

  return (
    <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums">
      <span className="text-[--text-dim] tracking-widest uppercase">BAR</span>
      <span className="text-[--text-secondary]">
        {bar}.{beat}.{sixteenth}
      </span>
    </div>
  );
}
