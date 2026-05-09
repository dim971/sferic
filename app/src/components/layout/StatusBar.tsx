import { useProjectStore } from '@/store/project-store';
import { useCpuMonitor } from '@/lib/use-monitoring';

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

export function StatusBar() {
  const project = useProjectStore((s) => s.project);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const selectedId = useProjectStore((s) => s.selectedKeyframeId);
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const monitoring = useProjectStore((s) => s.monitoring);
  const { cpu, bufferSize } = useCpuMonitor();

  const sortedIds = (project?.keyframes ?? [])
    .slice()
    .sort((a, b) => a.time - b.time)
    .map((k) => k.id);
  const selectedIdx = selectedId ? sortedIds.indexOf(selectedId) : -1;
  const selectedLabel =
    selectedIdx >= 0 ? `KF${(selectedIdx + 1).toString().padStart(2, '0')}` : '—';

  const ready = audioBuffer !== null;

  return (
    <div className="h-full px-3 flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-[--text-dim] bg-[--bg-base] border-t border-[--border-subtle]">
      <span className="flex items-center gap-1.5">
        <span
          className={`size-1.5 rounded-full ${ready ? 'bg-[--vu-green]' : 'bg-[--text-dim]'}`}
        />
        engine {ready ? 'ready' : 'idle'}
      </span>
      <span>
        <span>kf </span>
        <span className="text-[--text-secondary]">{project?.keyframes.length ?? 0}</span>
      </span>
      <span>
        <span>sel </span>
        <span className="text-[--text-secondary]">{selectedLabel}</span>
      </span>
      {project && (
        <span>
          <span>panning </span>
          <span className="text-[--text-secondary]">{project.settings.panningModel}</span>
        </span>
      )}
      <span>
        <span>monitor </span>
        <span className="text-[--text-secondary]">{monitoring}</span>
      </span>
      {audioBuffer && (
        <>
          <span>
            <span>sr </span>
            <span className="text-[--text-secondary]">
              {(audioBuffer.sampleRate / 1000).toFixed(1)}k
            </span>
          </span>
          <span>
            <span>cpu </span>
            <span className="text-[--text-secondary]">{cpu.toFixed(1)}%</span>
          </span>
          {bufferSize !== null && (
            <span>
              <span>buf </span>
              <span className="text-[--text-secondary]">{bufferSize}</span>
            </span>
          )}
        </>
      )}
      <span className="ml-auto">
        <span className="text-[--text-secondary]">{formatTime(currentTime)}</span>
      </span>
    </div>
  );
}
