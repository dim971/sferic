import { useProjectStore } from '@/store/project-store';

export function MonitoringToggle() {
  const monitoring = useProjectStore((s) => s.monitoring);
  const setMonitoring = useProjectStore((s) => s.setMonitoring);

  return (
    <div className="flex items-center gap-0.5 text-[10px] tracking-widest uppercase font-mono">
      {(['binaural', 'stereo'] as const).map((m) => {
        const active = monitoring === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMonitoring(m)}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              active
                ? 'bg-[--accent-soft] text-[--accent]'
                : 'text-[--text-dim] hover:text-[--text-secondary]'
            }`}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
