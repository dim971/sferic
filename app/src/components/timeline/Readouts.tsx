import { useProjectStore } from '@/store/project-store';
import { interpolatePosition, cartesianToSpherical } from '@/lib/math3d';

function fmt(v: number, digits = 2): string {
  return v >= 0 ? `+${v.toFixed(digits)}` : v.toFixed(digits);
}

export function Readouts() {
  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const keyframes = project?.keyframes ?? [];
  const pos = interpolatePosition(keyframes, currentTime);
  const sph = cartesianToSpherical(pos);

  const cells: { label: string; value: string }[] = [
    { label: 'X', value: fmt(pos.x, 2) },
    { label: 'Y', value: fmt(pos.y, 2) },
    { label: 'Z', value: fmt(pos.z, 2) },
    { label: 'Az', value: `${fmt(sph.az, 0)}°` },
    { label: 'El', value: `${fmt(sph.el, 0)}°` },
  ];

  return (
    <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
      {cells.map((c) => (
        <span key={c.label} className="flex items-baseline gap-1">
          <span className="text-[--text-dim] tracking-widest uppercase text-[10px]">{c.label}</span>
          <span className="text-[--text-secondary]">{c.value}</span>
        </span>
      ))}
    </div>
  );
}
