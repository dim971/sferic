import { useEffect, useState } from 'react';
import { AudioLines, Download, FileAudio, FolderOpen, Save } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { AudioEngine } from '@/lib/audio-engine';
import { useCpuMonitor } from '@/lib/use-monitoring';
import { RenderModal } from '@/components/render/RenderModal';
import { HorizontalVuMeter } from './HorizontalVuMeter';

const MENUS = ['File', 'Edit', 'Project', 'Render', 'View', 'Help'] as const;

export function Topbar() {
  const project = useProjectStore((s) => s.project);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const isDirty = useProjectStore((s) => s.isDirty);
  const loadAudioFromDialog = useProjectStore((s) => s.loadAudioFromDialog);
  const openProjectFromDialog = useProjectStore((s) => s.openProjectFromDialog);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const setRenderModalOpen = useProjectStore((s) => s.setRenderModalOpen);
  const renderModalOpen = useProjectStore((s) => s.renderModalOpen);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);

  const sampleRateK = audioBuffer ? Math.round(audioBuffer.sampleRate / 1000) : 0;
  const fileName = project?.audioFile.originalPath.split(/[/\\]/).pop() ?? '';
  const renderDisabled = !audioBuffer;
  const { cpu, bufferSize } = useCpuMonitor();

  const handleOpen = () => {
    if (project) void openProjectFromDialog();
    else void loadAudioFromDialog();
  };

  const handleSave = () => {
    if (!project) return;
    void saveCurrentProject();
  };

  return (
    <header className="h-full px-2 flex items-stretch gap-1 bg-[--bg-base]">
      {/* Orange square logo */}
      <div className="flex items-center gap-2 pr-2">
        <div className="w-7 h-7 rounded-md bg-[--accent] flex items-center justify-center">
          <AudioLines size={14} strokeWidth={2.5} className="text-white" />
        </div>
        <span className="text-[14px] font-medium text-[--text-primary]">Spatialize</span>
        <span className="text-[11px] text-[--text-dim] font-mono">1.4.2</span>
      </div>

      {/* Menus */}
      <nav className="flex items-center" aria-hidden>
        {MENUS.map((m) => (
          <button
            key={m}
            type="button"
            onMouseEnter={() => setHoveredMenu(m)}
            onMouseLeave={() => setHoveredMenu(null)}
            className={`text-[12px] px-2.5 py-1 rounded transition-colors ${
              hoveredMenu === m
                ? 'bg-[--bg-panel-elev] text-[--text-primary]'
                : 'text-[--text-secondary]'
            }`}
          >
            {m}
          </button>
        ))}
      </nav>

      {/* Project metadata */}
      <div className="flex items-center gap-2 text-[12px] flex-1 min-w-0 ml-2">
        {project ? (
          <>
            <FileAudio size={12} className="text-[--text-dim] flex-shrink-0" />
            <EditableProjectName />
            <span className="text-[--text-dim] flex-shrink-0">·</span>
            <span className="font-mono text-[--text-dim] truncate max-w-[280px]">{fileName}</span>
            <span className="text-[--text-dim] flex-shrink-0">·</span>
            <span className="font-mono text-[--text-dim] flex-shrink-0">{sampleRateK}kHz</span>
            <span className="text-[--text-dim] flex-shrink-0">·</span>
            <span className="font-mono text-[--text-dim] flex-shrink-0">24-bit</span>
            {isDirty && (
              <span className="ml-1 flex items-center gap-1.5 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md text-[--accent] border border-[--border-strong] flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[--accent]" aria-hidden />
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
          className="text-[12px] px-2.5 py-1 rounded-md bg-[--bg-panel-elev] border border-[--border-strong] text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-input] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Save size={12} strokeWidth={1.75} />
          <span>Save</span>
          <span className="text-[10px] text-[--text-dim] font-mono ml-0.5">⌘S</span>
        </button>
        <button
          type="button"
          onClick={handleOpen}
          title={project ? 'Open project (⌘O)' : 'Open audio (⌘I)'}
          className="text-[12px] px-2.5 py-1 rounded-md bg-[--bg-panel-elev] border border-[--border-strong] text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-input] flex items-center gap-1.5"
        >
          <FolderOpen size={12} strokeWidth={1.75} />
          <span>Open</span>
          <span className="text-[10px] text-[--text-dim] font-mono ml-0.5">⌘O</span>
        </button>

        {audioBuffer && (
          <div className="flex flex-col text-[10px] font-mono tabular-nums leading-[1.15] px-1.5">
            <div className="text-[--text-dim]">
              CPU{' '}
              <span
                className={cpu > 75 ? 'text-[--vu-red]' : cpu > 50 ? 'text-[--vu-yellow]' : 'text-[--vu-green]'}
              >
                {cpu.toFixed(1)}%
              </span>
            </div>
            <div className="text-[--text-dim]">
              BUF <span className="text-[--text-secondary]">{bufferSize ?? '—'}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-0.5 px-1">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[--text-dim] font-mono w-2">L</span>
            <HorizontalVuMeter analyser={AudioEngine.getAnalyserL()} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[--text-dim] font-mono w-2">R</span>
            <HorizontalVuMeter analyser={AudioEngine.getAnalyserR()} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRenderModalOpen(true)}
          disabled={renderDisabled}
          title="Render (⌘R)"
          className="text-[12px] px-3 py-1 rounded-md bg-[--accent] hover:bg-[--accent-hot] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
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
        className="bg-[--bg-input] text-[12px] text-[--text-primary] px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-[--accent] max-w-[280px]"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to rename project"
      className="text-[--text-secondary] hover:text-[--text-primary] truncate max-w-[280px] text-left"
    >
      {project.meta.name}
    </button>
  );
}
