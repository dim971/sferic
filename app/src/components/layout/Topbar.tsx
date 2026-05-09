import { useEffect, useState } from 'react';
import { AudioLines, Download, FileAudio, FolderOpen, Save } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { AudioEngine } from '@/lib/audio-engine';
import { useCpuMonitor } from '@/lib/use-monitoring';
import { RenderModal } from '@/components/render/RenderModal';
import { HorizontalVuMeter } from './HorizontalVuMeter';
import { MenuBar } from './MenuBar';

export function Topbar() {
  const project = useProjectStore((s) => s.project);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const isDirty = useProjectStore((s) => s.isDirty);
  const openAnyFromDialog = useProjectStore((s) => s.openAnyFromDialog);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const setRenderModalOpen = useProjectStore((s) => s.setRenderModalOpen);
  const renderModalOpen = useProjectStore((s) => s.renderModalOpen);

  const sampleRateK = audioBuffer ? Math.round(audioBuffer.sampleRate / 1000) : 0;
  const fileName = project?.audioFile.originalPath.split(/[/\\]/).pop() ?? '';
  const bitDepth = project?.audioFile.sourceBitDepth;
  const bitDepthLabel = bitDepth != null ? `${bitDepth}-bit` : '32-bit float';
  const renderDisabled = !audioBuffer;
  const { cpu, bufferSize } = useCpuMonitor();

  const handleOpen = () => {
    void openAnyFromDialog();
  };

  const handleSave = () => {
    if (!project) return;
    void saveCurrentProject();
  };

  return (
    <header className="h-full px-2 flex items-stretch gap-1 bg-[var(--bg-base)]">
      {/* Orange square logo */}
      <div className="flex items-center gap-2 pr-2">
        <div className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center">
          <AudioLines size={14} strokeWidth={2.5} className="text-white" />
        </div>
        <span className="text-[14px] font-medium text-[var(--text-primary)]">Sferic</span>
        <span className="text-[11px] text-[var(--text-dim)] font-mono">1.4.2</span>
      </div>

      {/* Menus */}
      <MenuBar />

      {/* Project metadata */}
      <div className="flex items-center gap-2 text-[12px] flex-1 min-w-0 ml-2">
        {project ? (
          <>
            <FileAudio size={12} className="text-[var(--text-dim)] flex-shrink-0" />
            <EditableProjectName />
            <span className="text-[var(--text-dim)] flex-shrink-0">·</span>
            <span className="font-mono text-[var(--text-dim)] truncate max-w-[280px]">{fileName}</span>
            <span className="text-[var(--text-dim)] flex-shrink-0">·</span>
            <span className="font-mono text-[var(--text-dim)] flex-shrink-0">{sampleRateK}kHz</span>
            <span className="text-[var(--text-dim)] flex-shrink-0">·</span>
            <span className="font-mono text-[var(--text-dim)] flex-shrink-0">{bitDepthLabel}</span>
            {isDirty && (
              <span className="ml-1 flex items-center gap-1.5 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md text-[var(--accent)] border border-[var(--border-strong)] flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
                UNSAVED
              </span>
            )}
          </>
        ) : null}
      </div>

      {/* Right cluster: Save, Open, CPU/BUF, VU, Render */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!project}
          title="Save (⌘S)"
          className="text-[12px] px-2.5 py-1 rounded-md bg-[var(--bg-panel-elev)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Save size={12} strokeWidth={1.75} />
          <span>Save</span>
          <span className="text-[10px] text-[var(--text-dim)] font-mono ml-0.5">⌘S</span>
        </button>
        <button
          type="button"
          onClick={handleOpen}
          title={project ? 'Open project (⌘O)' : 'Open audio (⌘I)'}
          className="text-[12px] px-2.5 py-1 rounded-md bg-[var(--bg-panel-elev)] border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-1.5"
        >
          <FolderOpen size={12} strokeWidth={1.75} />
          <span>Open</span>
          <span className="text-[10px] text-[var(--text-dim)] font-mono ml-0.5">⌘O</span>
        </button>

        {audioBuffer && (
          <div className="flex flex-col text-[10px] font-mono tabular-nums leading-[1.15] px-1.5">
            <div className="text-[var(--text-dim)]">
              CPU{' '}
              <span
                className={cpu > 75 ? 'text-[var(--vu-red)]' : cpu > 50 ? 'text-[var(--vu-yellow)]' : 'text-[var(--vu-green)]'}
              >
                {cpu.toFixed(1)}%
              </span>
            </div>
            <div className="text-[var(--text-dim)]">
              BUF <span className="text-[var(--text-secondary)]">{bufferSize ?? '—'}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-0.5 px-1">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[var(--text-dim)] font-mono w-2">L</span>
            <HorizontalVuMeter analyser={AudioEngine.getAnalyserL()} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[var(--text-dim)] font-mono w-2">R</span>
            <HorizontalVuMeter analyser={AudioEngine.getAnalyserR()} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRenderModalOpen(true)}
          disabled={renderDisabled}
          title="Render (⌘R)"
          className="text-[12px] px-3 py-1 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hot)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Download size={12} strokeWidth={2} />
          Render
        </button>
      </div>

      {renderModalOpen && audioBuffer && project && (
        <RenderModal onClose={() => setRenderModalOpen(false)} />
      )}
    </header>
  );
}

function EditableProjectName() {
  const project = useProjectStore((s) => s.project);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!editing) setDraft(project?.meta.name ?? '');
  }, [project, editing]);

  if (!project) return null;

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) setProjectName(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setEditing(false);
            setDraft(project.meta.name);
          }
        }}
        className="bg-[var(--bg-input)] text-[12px] text-[var(--text-primary)] px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-[var(--accent)] max-w-[280px]"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to rename project"
      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] truncate max-w-[280px] text-left"
    >
      {project.meta.name}
    </button>
  );
}
