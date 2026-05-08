import { useProjectStore } from '@/store/project-store';
import { interpolatePosition, cartesianToSpherical } from '@/lib/math3d';

function fmt(v: number, digits = 1): string {
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
    <div className="grid grid-cols-5 gap-x-2 gap-y-0.5 text-[10px] font-mono tabular-nums leading-tight">
      {cells.map((c) => (
        <span key={c.label} className="text-[--text-dim]">
          {c.label}
        </span>
      ))}
      {cells.map((c) => (
        <span key={c.label + 'v'} className="text-[--text-secondary]">
          {c.value}
        </span>
      ))}
    </div>
  );
}
