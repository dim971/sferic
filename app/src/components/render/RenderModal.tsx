import { useState } from 'react';
import { X } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '@/store/project-store';
import { renderProject } from '@/lib/render-offline';
import { encodeWav, type WavBitDepth } from '@/lib/wav-encoder';
import { encodeMp3, type Mp3Bitrate } from '@/lib/mp3-encoder';

interface RenderModalProps {
  onClose: () => void;
}

type Stage = 'idle' | 'rendering' | 'encoding' | 'saving' | 'done' | 'error';
type Format = 'wav' | 'mp3';
type Range = 'full' | 'custom';
const BITRATES: Mp3Bitrate[] = [192, 256, 320];
const BIT_DEPTHS: WavBitDepth[] = [16, 24, 32];

function bitDepthLabel(b: WavBitDepth): string {
  return b === 32 ? '32f' : String(b);
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

export function RenderModal({ onClose }: RenderModalProps) {
  const project = useProjectStore((s) => s.project);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>('wav');
  const [bitrate, setBitrate] = useState<Mp3Bitrate>(320);
  const [bitDepth, setBitDepth] = useState<WavBitDepth>(24);
  const [dither, setDither] = useState(true);
  const [range, setRange] = useState<Range>('full');
  const duration = audioBuffer?.duration ?? 0;
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);

  if (!project || !audioBuffer) {
    return null;
  }

  const effectiveStart = range === 'full' ? 0 : Math.max(0, Math.min(start, duration));
  const effectiveEnd = range === 'full' ? duration : Math.max(effectiveStart + 0.01, Math.min(end, duration));

  const handleRender = async () => {
    setError(null);
    setStage('rendering');
    try {
      const rendered = await renderProject(
        project,
        audioBuffer,
        range === 'custom' ? { startSec: effectiveStart, endSec: effectiveEnd } : undefined,
      );
      setStage('encoding');
      const bytes =
        format === 'wav'
          ? encodeWav(rendered, { bitDepth, dither: bitDepth === 16 ? dither : false })
          : encodeMp3(rendered, bitrate);
      setStage('saving');
      const ext = format;
      const path = await save({
        defaultPath: `${project.meta.name || 'sferic-render'}.${ext}`,
        filters: [
          format === 'wav'
            ? { name: 'WAV', extensions: ['wav'] }
            : { name: 'MP3', extensions: ['mp3'] },
        ],
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
    encoding: format === 'wav' ? `Encodage WAV ${bitDepthLabel(bitDepth)}-bit…` : 'Encodage MP3…',
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
        className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-lg w-[480px] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-medium tracking-wide">Render</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-30"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3 text-[12px]">
          <Row label="Project">
            <span className="text-[var(--text-secondary)]">{project.meta.name}</span>
          </Row>
          <Row label="Format">
            <div className="flex gap-1">
              {(['wav', 'mp3'] as const).map((f) => (
                <Chip key={f} active={format === f} onClick={() => setFormat(f)} disabled={busy}>
                  {f.toUpperCase()}
                </Chip>
              ))}
            </div>
          </Row>
          {format === 'wav' && (
            <>
              <Row label="Bit depth">
                <div className="flex gap-1">
                  {BIT_DEPTHS.map((b) => (
                    <Chip
                      key={b}
                      active={bitDepth === b}
                      onClick={() => setBitDepth(b)}
                      disabled={busy}
                    >
                      {bitDepthLabel(b)}
                    </Chip>
                  ))}
                  <span className="self-center text-[10px] text-[var(--text-dim)] ml-1">bit</span>
                </div>
              </Row>
              {bitDepth === 16 && (
                <Row label="Dither">
                  <Toggle checked={dither} onChange={setDither} disabled={busy} />
                  <span className="ml-2 text-[10px] text-[var(--text-dim)]">TPDF, 1 LSB</span>
                </Row>
              )}
            </>
          )}
          {format === 'mp3' && (
            <Row label="Bitrate">
              <div className="flex gap-1">
                {BITRATES.map((b) => (
                  <Chip key={b} active={bitrate === b} onClick={() => setBitrate(b)} disabled={busy}>
                    {b}
                  </Chip>
                ))}
                <span className="self-center text-[10px] text-[var(--text-dim)] ml-1">kbps</span>
              </div>
            </Row>
          )}

          <Row label="Range">
            <div className="flex flex-col gap-2">
              <div className="flex gap-1">
                {(['full', 'custom'] as const).map((r) => (
                  <Chip key={r} active={range === r} onClick={() => setRange(r)} disabled={busy}>
                    {r === 'full' ? 'full track' : 'custom'}
                  </Chip>
                ))}
              </div>
              {range === 'custom' && (
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
                  <span>start</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={duration}
                    value={start}
                    onChange={(e) => setStart(Math.max(0, parseFloat(e.currentTarget.value) || 0))}
                    disabled={busy}
                    className="bg-[var(--bg-input)] text-[var(--text-primary)] font-mono px-2 py-1 rounded-md w-24"
                  />
                  <span>end</span>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={duration}
                    value={end || duration}
                    onChange={(e) => setEnd(parseFloat(e.currentTarget.value) || duration)}
                    disabled={busy}
                    className="bg-[var(--bg-input)] text-[var(--text-primary)] font-mono px-2 py-1 rounded-md w-24"
                  />
                  <span className="ml-auto text-[var(--text-secondary)] font-mono">
                    {formatTime(effectiveEnd - effectiveStart)}
                  </span>
                </div>
              )}
            </div>
          </Row>

          <Row label="Sample rate">
            <span className="font-mono text-[var(--text-secondary)]">{audioBuffer.sampleRate} Hz</span>
          </Row>
          <Row label="Channels">
            <span className="text-[var(--text-secondary)]">2 (stéréo HRTF)</span>
          </Row>
          <Row label="Keyframes">
            <span className="font-mono text-[var(--text-secondary)]">
              {project.keyframes.length}
            </span>
          </Row>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span
            className={`text-[12px] ${
              stage === 'error'
                ? 'text-[var(--vu-red)]'
                : stage === 'done'
                  ? 'text-[var(--vu-green)]'
                  : 'text-[var(--text-secondary)]'
            }`}
          >
            {error ?? stageLabel[stage]}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-[14px] px-3 py-1 rounded-md border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
            >
              {stage === 'done' ? 'Close' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleRender}
              disabled={busy}
              className="text-[14px] px-4 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hot)] text-white font-medium disabled:opacity-40 flex items-center gap-2"
            >
              {busy && <Spinner />}
              Render
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
      <span className="text-[11px] text-[var(--text-dim)]">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function Chip({ active, onClick, disabled, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 text-[11px] rounded-md transition-colors disabled:opacity-30 ${
        active
          ? 'bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent)]'
          : 'border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-3 w-6 rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-2 w-2 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`}
      />
    </button>
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
