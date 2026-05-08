import { useState } from 'react';
import { X } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '@/store/project-store';
import { renderProject } from '@/lib/render-offline';
import { encodeWav16 } from '@/lib/wav-encoder';

interface RenderModalProps {
  onClose: () => void;
}

type Stage = 'idle' | 'rendering' | 'encoding' | 'saving' | 'done' | 'error';

export function RenderModal({ onClose }: RenderModalProps) {
  const project = useProjectStore((s) => s.project);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!project || !audioBuffer) {
    return null;
  }

  const handleRender = async () => {
    setError(null);
    setStage('rendering');
    try {
      const rendered = await renderProject(project, audioBuffer);
      setStage('encoding');
      const bytes = encodeWav16(rendered);
      setStage('saving');
      const path = await save({
        defaultPath: `${project.meta.name || 'spatialize-render'}.wav`,
        filters: [{ name: 'WAV', extensions: ['wav'] }],
      });
      if (!path) {
        setStage('idle');
        return;
      }
      await writeFile(path, bytes);
      setStage('done');
      window.setTimeout(onClose, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('error');
    }
  };

  const busy = stage === 'rendering' || stage === 'encoding' || stage === 'saving';
  const stageLabel: Record<Stage, string> = {
    idle: '',
    rendering: 'Rendu offline en cours…',
    encoding: 'Encodage WAV…',
    saving: 'Sauvegarde…',
    done: 'Exporté ✓',
    error: 'Erreur',
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="bg-[--bg-panel] border border-[--border-strong] rounded-lg w-[420px] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-medium tracking-wide">Render</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-[--text-dim] hover:text-[--text-primary] disabled:opacity-30"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3 text-[12px]">
          <Row label="Project">
            <span className="text-[--text-secondary]">{project.meta.name}</span>
          </Row>
          <Row label="Duration">
            <span className="font-mono tabular-nums text-[--text-secondary]">
              {audioBuffer.duration.toFixed(2)} s
            </span>
          </Row>
          <Row label="Format">
            <span className="text-[--text-secondary]">WAV · 16-bit PCM</span>
          </Row>
          <Row label="Sample rate">
            <span className="font-mono text-[--text-secondary]">
              {audioBuffer.sampleRate} Hz
            </span>
          </Row>
          <Row label="Channels">
            <span className="text-[--text-secondary]">
              2 (stéréo HRTF)
            </span>
          </Row>
          <Row label="Keyframes">
            <span className="font-mono text-[--text-secondary]">
              {project.keyframes.length}
            </span>
          </Row>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span
            className={`text-[12px] ${
              stage === 'error'
                ? 'text-[--vu-red]'
                : stage === 'done'
                  ? 'text-[--vu-green]'
                  : 'text-[--text-secondary]'
            }`}
          >
            {error ?? stageLabel[stage]}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-[14px] px-3 py-1 rounded-md border border-[--border-strong] text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-30"
            >
              {stage === 'done' ? 'Close' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleRender}
              disabled={busy}
              className="text-[14px] px-4 py-1.5 rounded-md bg-[--accent] hover:bg-[--accent-hot] text-white font-medium disabled:opacity-40 flex items-center gap-2"
            >
              {busy && <Spinner />}
              Render
            </button>
          </div>
        </div>

        <p className="mt-3 text-[10px] text-[--text-dim]">
          MP3 / 24-bit / sélection / dithering différés à v1.5.
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
      <span className="text-[11px] text-[--text-dim]">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"
    />
  );
}
