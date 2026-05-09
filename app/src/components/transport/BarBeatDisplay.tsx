import { useProjectStore } from '@/store/project-store';
import { timeToBarBeat } from '@/lib/audio-analysis';

export function BarBeatDisplay() {
  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const bpm = project?.audioMeta.bpm ?? null;

  const display = bpm !== null ? timeToBarBeat(currentTime, bpm) : null;

  return (
    <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums">
      <span className="text-[--text-dim] tracking-widest uppercase">BAR</span>
      <span className={display ? 'text-[--text-secondary]' : 'text-[--text-dim]'}>
        {display ? `${display.bar}.${display.beat}.${display.sixteenth}` : '—.—.—'}
      </span>
    </div>
  );
}
