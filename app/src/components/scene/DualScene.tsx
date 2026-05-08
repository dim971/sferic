import { useProjectStore } from '@/store/project-store';
import { interpolatePosition, cartesianToSpherical } from '@/lib/math3d';
import { SceneTop } from './SceneTop';
import { ScenePerspective } from './ScenePerspective';

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

export function DualScene() {
  const project = useProjectStore((s) => s.project);
  const keyframes = project?.keyframes ?? [];
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const pos = interpolatePosition(keyframes, currentTime);
  const sph = cartesianToSpherical(pos);
  const tc = formatTime(currentTime);

  return (
    <div className="grid grid-cols-2 h-full">
      <ScenePanel
        label="TOP"
        timecode={tc}
        bottomLeft="-1.0"
        bottomRight="+1.0"
      >
        <SceneTop />
      </ScenePanel>
      <ScenePanel
        label="PERSPECTIVE"
        timecode={tc}
        bottomLeft={`Az ${sph.az.toFixed(1)}°`}
        bottomRight={`El ${sph.el.toFixed(1)}°`}
        leftBorder
      >
        <ScenePerspective />
      </ScenePanel>
    </div>
  );
}

interface ScenePanelProps {
  label: string;
  timecode: string;
  bottomLeft: string;
  bottomRight: string;
  leftBorder?: boolean;
  children: React.ReactNode;
}

function ScenePanel({ label, timecode, bottomLeft, bottomRight, leftBorder, children }: ScenePanelProps) {
  return (
    <div
      className={`relative h-full ${leftBorder ? 'border-l border-[--border-subtle]' : ''}`}
    >
      {children}
      <div className="absolute top-2 left-3 text-[10px] tracking-widest uppercase text-[--text-dim] pointer-events-none">
        {label}
      </div>
      <div className="absolute top-2 right-3 font-mono text-[12px] text-[--text-secondary] pointer-events-none">
        {timecode}
      </div>
      <div className="absolute bottom-2 left-3 font-mono text-[10px] text-[--text-dim] pointer-events-none">
        {bottomLeft}
      </div>
      <div className="absolute bottom-2 right-3 font-mono text-[10px] text-[--text-dim] pointer-events-none">
        {bottomRight}
      </div>
    </div>
  );
}
