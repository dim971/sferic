import { useState, useEffect } from 'react';
import { useProjectStore } from '@/store/project-store';

export function BpmDisplay() {
  const project = useProjectStore((s) => s.project);
  const setAudioMeta = useProjectStore((s) => s.setAudioMeta);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const bpm = project?.audioMeta.bpm ?? null;

  useEffect(() => {
    if (!editing) setDraft(bpm !== null ? String(bpm) : '');
  }, [bpm, editing]);

  if (!project) return null;
  const detecting = bpm === null && !editing;

  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n) && n > 0) setAudioMeta({ bpm: Math.round(n) });
    else if (draft.trim() === '') setAudioMeta({ bpm: null });
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums">
      <span className="text-[--text-dim] tracking-widest uppercase">BPM</span>
      {editing ? (
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setEditing(false);
              setDraft(bpm !== null ? String(bpm) : '');
            }
          }}
          className="bg-[--bg-input] w-12 text-[--text-primary] px-1 rounded outline-none focus:ring-1 focus:ring-[--accent]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`hover:text-[--text-primary] ${detecting ? 'text-[--text-dim] italic' : 'text-[--text-secondary]'}`}
          title={detecting ? 'Détection BPM en cours… clic pour saisir manuellement' : 'Clic pour modifier'}
        >
          {bpm !== null ? bpm : '…'}
        </button>
      )}
    </div>
  );
}
