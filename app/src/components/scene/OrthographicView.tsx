import { useMemo, useRef } from 'react';
import { Crosshair, Lock, LockOpen, Maximize } from 'lucide-react';
import type { Projection, SpatialKeyframe } from '@/types/project';
import { useProjectStore } from '@/store/project-store';
import { interpolatePosition, cartesianToSpherical, type Vec3 } from '@/lib/math3d';

interface OrthographicViewProps {
  projection: Projection;
}

interface PlaneMeta {
  label: string;
  plane: string;
  topAxis: string;
  bottomAxis: string;
  leftAxis: string;
  rightAxis: string;
  axisU: string;
  axisV: string;
}

const META: Record<Projection, PlaneMeta> = {
  top: {
    label: 'TOP',
    plane: 'X / Z',
    topAxis: '-Z',
    bottomAxis: '+Z',
    leftAxis: '-X',
    rightAxis: '+X',
    axisU: 'x',
    axisV: 'z',
  },
  side: {
    label: 'SIDE',
    plane: 'Z / Y',
    topAxis: '+Y',
    bottomAxis: '-Y',
    leftAxis: '-Z',
    rightAxis: '+Z',
    axisU: 'z',
    axisV: 'y',
  },
};

function project(p: Vec3, proj: Projection): { sx: number; sy: number } {
  if (proj === 'top') return { sx: p.x, sy: p.z };
  return { sx: p.z, sy: -p.y };
}

function snapAngleXY(sx: number, sy: number, snapDeg: number): { sx: number; sy: number } {
  if (snapDeg <= 0) return { sx, sy };
  const r = Math.hypot(sx, sy);
  if (r === 0) return { sx: 0, sy: 0 };
  const theta = Math.atan2(sy, sx);
  const step = (snapDeg * Math.PI) / 180;
  const snapped = Math.round(theta / step) * step;
  return { sx: r * Math.cos(snapped), sy: r * Math.sin(snapped) };
}

function fmt(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

export function OrthographicView({ projection }: OrthographicViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const projectState = useProjectStore((s) => s.project);
  const selectedId = useProjectStore((s) => s.selectedKeyframeId);
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const isPlaying = useProjectStore((s) => s.playback.isPlaying);
  const view = useProjectStore((s) => s.viewStates[projection]);
  const snapAngleDeg = useProjectStore((s) => s.snapAngleDeg);
  const setViewState = useProjectStore((s) => s.setViewState);
  const setSnapAngle = useProjectStore((s) => s.setSnapAngle);
  const addKeyframeAtProjection = useProjectStore((s) => s.addKeyframeAtProjection);
  const moveKeyframe = useProjectStore((s) => s.moveKeyframe);
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);

  const meta = META[projection];
  const keyframes = projectState?.keyframes ?? [];

  const sortedKfs = useMemo(
    () => [...keyframes].sort((a, b) => a.time - b.time),
    [keyframes],
  );
  const numByKf = useMemo(() => {
    const map = new Map<string, number>();
    sortedKfs.forEach((k, i) => map.set(k.id, i + 1));
    return map;
  }, [sortedKfs]);

  const sourcePos = interpolatePosition(keyframes, currentTime);
  const cur = project(sourcePos, projection);
  const sph = cartesianToSpherical(sourcePos);

  const half = 1.2 / view.zoom;
  const viewBox = `${-half} ${-half} ${half * 2} ${half * 2}`;

  const dragRef = useRef<{ id: string } | null>(null);

  const pointerToSvg = (e: { clientX: number; clientY: number }) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const size = half * 2;
    return { sx: (px - 0.5) * size, sy: (py - 0.5) * size };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (view.locked) return;
    const target = (e.target as Element).closest('[data-kf-id]');
    if (target) {
      const id = target.getAttribute('data-kf-id');
      if (!id) return;
      e.stopPropagation();
      selectKeyframe(id);
      dragRef.current = { id };
      let raf = 0;
      let pending: { sx: number; sy: number } | null = null;
      const flush = () => {
        if (pending && dragRef.current) {
          moveKeyframe(dragRef.current.id, projection, pending.sx, pending.sy);
        }
        raf = 0;
      };
      const onMove = (ev: PointerEvent) => {
        const w = pointerToSvg(ev);
        if (!w) return;
        const snapped = snapAngleXY(w.sx, w.sy, snapAngleDeg);
        pending = snapped;
        if (!raf) raf = requestAnimationFrame(flush);
      };
      const onUp = () => {
        dragRef.current = null;
        if (raf) cancelAnimationFrame(raf);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      return;
    }
    if (!projectState) return;
    const w = pointerToSvg(e);
    if (!w) return;
    const snapped = snapAngleXY(w.sx, w.sy, snapAngleDeg);
    addKeyframeAtProjection(projection, snapped.sx, snapped.sy);
  };

  const recenter = () => setViewState(projection, { zoom: 1 });
  const toggleLock = () => setViewState(projection, { locked: !view.locked });
  const cycleSnap = () => {
    const cycle = [0, 5, 15, 30, 45, 90];
    const idx = cycle.indexOf(snapAngleDeg);
    setSnapAngle(cycle[(idx + 1) % cycle.length]);
  };

  return (
    <div className="flex flex-col h-full bg-[--bg-panel] min-h-0 min-w-0">
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono tabular-nums text-[--text-secondary] border-b border-[--border-subtle]">
        <span>
          <span className="tracking-widest uppercase text-[--text-dim]">{meta.label}</span>
          <span className="text-[--text-dim] ml-2">{meta.plane}</span>
          <span className="ml-2">{view.zoom.toFixed(1)}×</span>
        </span>
        <button
          type="button"
          onClick={cycleSnap}
          className="flex items-center gap-2 hover:text-[--text-primary]"
          aria-label="Cycle snap angle"
        >
          Snap {snapAngleDeg}°
          <span
            className={`size-1.5 rounded-full ${snapAngleDeg > 0 ? 'bg-[--accent]' : 'bg-[--vu-green]'}`}
          />
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full select-none"
          style={{ cursor: view.locked ? 'not-allowed' : 'crosshair' }}
          onPointerDown={handlePointerDown}
        >
          {/* Reference circles */}
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <circle
              key={r}
              cx={0}
              cy={0}
              r={r}
              fill="none"
              stroke="#2a2e38"
              strokeWidth={r === 1 ? 0.006 : 0.003}
              strokeDasharray={r === 1 ? undefined : '0.02 0.02'}
            />
          ))}

          {/* Axes */}
          <line x1={-half} y1={0} x2={half} y2={0} stroke="#1f222a" strokeWidth={0.003} />
          <line x1={0} y1={-half} x2={0} y2={half} stroke="#1f222a" strokeWidth={0.003} />

          {/* Axis labels */}
          <text
            x={half - 0.04}
            y={-0.04}
            fontSize={0.06}
            fill="#5a5f6b"
            textAnchor="end"
            fontFamily="JetBrains Mono, monospace"
          >
            {meta.rightAxis}
          </text>
          <text
            x={-half + 0.04}
            y={-0.04}
            fontSize={0.06}
            fill="#5a5f6b"
            fontFamily="JetBrains Mono, monospace"
          >
            {meta.leftAxis}
          </text>
          <text
            x={0.04}
            y={-half + 0.08}
            fontSize={0.06}
            fill="#5a5f6b"
            fontFamily="JetBrains Mono, monospace"
          >
            {meta.topAxis}
          </text>
          <text
            x={0.04}
            y={half - 0.04}
            fontSize={0.06}
            fill="#5a5f6b"
            fontFamily="JetBrains Mono, monospace"
          >
            {meta.bottomAxis}
          </text>

          {/* Path */}
          {sortedKfs.length > 1 && (
            <path
              d={sortedKfs
                .map((k, i) => {
                  const p = project(k.position, projection);
                  return `${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(4)} ${p.sy.toFixed(4)}`;
                })
                .join(' ')}
              fill="none"
              stroke="#F87328"
              strokeOpacity={0.5}
              strokeWidth={0.008}
              strokeDasharray="0.025 0.02"
            />
          )}

          {/* Keyframes */}
          {sortedKfs.map((k) => {
            const p = project(k.position, projection);
            const num = numByKf.get(k.id) ?? 0;
            const isSel = k.id === selectedId;
            return (
              <KeyframeNode
                key={k.id}
                keyframe={k}
                num={num}
                sx={p.sx}
                sy={p.sy}
                selected={isSel}
              />
            );
          })}

          {/* Listener at center */}
          <g aria-hidden>
            <circle cx={0} cy={0} r={0.045} fill="#4F8EF7" />
            <polygon
              points="0,-0.085 0.025,-0.04 -0.025,-0.04"
              fill="#4F8EF7"
              opacity={0.6}
            />
          </g>

          {/* Live source cursor (only when playing) */}
          {isPlaying && projectState && sortedKfs.length > 0 && (
            <g aria-hidden>
              <circle
                cx={cur.sx}
                cy={cur.sy}
                r={0.05}
                fill="#FF8A3D"
                opacity={0.25}
              />
              <circle cx={cur.sx} cy={cur.sy} r={0.022} fill="#FFD9B8" />
            </g>
          )}
        </svg>

        {/* Floating controls */}
        <div className="absolute bottom-2 right-2 flex gap-1">
          <ViewControl onClick={recenter} title="Auto-fit (1.0×)">
            <Maximize size={12} strokeWidth={1.75} />
          </ViewControl>
          <ViewControl onClick={() => setViewState(projection, { zoom: 1 })} title="Recentrer">
            <Crosshair size={12} strokeWidth={1.75} />
          </ViewControl>
          <ViewControl
            onClick={toggleLock}
            title={view.locked ? 'Déverrouiller' : 'Verrouiller'}
            active={view.locked}
          >
            {view.locked ? (
              <Lock size={12} strokeWidth={1.75} />
            ) : (
              <LockOpen size={12} strokeWidth={1.75} />
            )}
          </ViewControl>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono tabular-nums text-[--text-dim] border-t border-[--border-subtle]">
        <span>
          cur {meta.axisU} {fmt(cur.sx)}
          <span className="ml-3">
            {meta.axisV} {fmt(cur.sy)}
          </span>
          <span className="ml-3">az {sph.az >= 0 ? '+' : ''}{sph.az.toFixed(0)}°</span>
        </span>
      </div>
    </div>
  );
}

interface KeyframeNodeProps {
  keyframe: SpatialKeyframe;
  num: number;
  sx: number;
  sy: number;
  selected: boolean;
}

function KeyframeNode({ keyframe, num, sx, sy, selected }: KeyframeNodeProps) {
  return (
    <g
      data-kf-id={keyframe.id}
      transform={`translate(${sx} ${sy})`}
      style={{ cursor: 'grab' }}
    >
      {selected && (
        <circle
          r={0.06}
          fill="none"
          stroke="#F87328"
          strokeWidth={0.005}
          strokeDasharray="0.012 0.012"
        />
      )}
      <circle r={0.04} fill="#F87328" stroke="#0A0A0A" strokeWidth={0.008} />
      <text
        y={0.018}
        textAnchor="middle"
        fontSize={0.05}
        fill="#0A0A0A"
        fontFamily="JetBrains Mono, monospace"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {num}
      </text>
    </g>
  );
}

interface ViewControlProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}

function ViewControl({ onClick, title, active, children }: ViewControlProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-[--accent-soft] text-[--accent]'
          : 'bg-[--bg-panel-elev] text-[--text-secondary] hover:text-[--text-primary]'
      }`}
    >
      {children}
    </button>
  );
}
