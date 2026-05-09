import { useProjectStore } from '@/store/project-store';

interface RulerProps {
  duration: number;
}

function format(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pickInterval(duration: number): number {
  if (duration < 30) return 5;
  if (duration < 120) return 10;
  if (duration < 600) return 30;
  return 60;
}

export function Ruler({ duration }: RulerProps) {
  const project = useProjectStore((s) => s.project);
  const selectedId = useProjectStore((s) => s.selectedKeyframeId);
  const selected = project?.keyframes.find((k) => k.id === selectedId);

  if (duration <= 0) return null;
  const interval = pickInterval(duration);
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 0.001; t += interval) ticks.push(t);

  return (
    <div className="relative h-4 border-t border-[var(--border-subtle)]">
      {ticks.map((t) => (
        <span
          key={t}
          className="absolute top-0.5 -translate-x-1/2 font-mono text-[10px] text-[var(--text-dim)] tabular-nums"
          style={{ left: `${(t / duration) * 100}%` }}
        >
          {format(t)}
        </span>
      ))}
      {selected && (
        <span
          className="absolute top-0.5 -translate-x-1/2 font-mono text-[10px] text-[var(--accent)] tabular-nums"
          style={{ left: `${(selected.time / duration) * 100}%` }}
        >
          {format(selected.time)}
        </span>
      )}
    </div>
  );
}
