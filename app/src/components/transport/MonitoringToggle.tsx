import { useProjectStore } from '@/store/project-store';

export function MonitoringToggle() {
  const monitoring = useProjectStore((s) => s.monitoring);
  const setMonitoring = useProjectStore((s) => s.setMonitoring);

  return (
    <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase font-mono">
      <span className="text-[--text-dim]">monitor</span>
      <div className="flex items-center gap-0.5 rounded-md border border-[--border-strong] p-0.5">
        {(['binaural', 'stereo'] as const).map((m) => {
          const active = monitoring === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMonitoring(m)}
              className={`px-2 py-0.5 rounded transition-colors ${
                active
                  ? 'bg-[--accent] text-white'
                  : 'text-[--text-dim] hover:text-[--text-secondary]'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
