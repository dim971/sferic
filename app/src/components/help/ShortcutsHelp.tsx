import { X } from 'lucide-react';

interface ShortcutsHelpProps {
  onClose: () => void;
}

const SHORTCUTS: { label: string; keys: string }[] = [
  { label: 'Play / Pause', keys: 'Space' },
  { label: 'Insert keyframe', keys: '⌘K' },
  { label: 'Delete selected keyframe', keys: 'Delete' },
  { label: 'Deselect', keys: 'Esc' },
  { label: 'Save project', keys: '⌘S' },
  { label: 'Save project as…', keys: '⌘⇧S' },
  { label: 'Open project', keys: '⌘O' },
  { label: 'Open audio file', keys: '⌘I' },
  { label: 'Render…', keys: '⌘R' },
  { label: 'Toggle BINAURAL / STEREO', keys: '⌘M' },
  { label: 'Add keyframe on waveform', keys: 'Shift + click' },
  { label: 'Add keyframe in scene', keys: 'Click empty area' },
];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[--bg-panel] border border-[--border-strong] rounded-lg w-[440px] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-medium tracking-wide">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[--text-dim] hover:text-[--text-primary]"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <dl className="text-[12px] grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="contents">
              <dt className="text-[--text-secondary]">{s.label}</dt>
              <dd className="font-mono text-[--text-primary] text-right">{s.keys}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
