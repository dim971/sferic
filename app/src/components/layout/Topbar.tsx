import { Download, FolderOpen, Save } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { AudioEngine } from '@/lib/audio-engine';
import { VuMeter } from './VuMeter';

export function Topbar() {
  const project = useProjectStore((s) => s.project);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const isDirty = useProjectStore((s) => s.isDirty);
  const loadAudioFromDialog = useProjectStore((s) => s.loadAudioFromDialog);
  const openProjectFromDialog = useProjectStore((s) => s.openProjectFromDialog);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const setRenderModalOpen = useProjectStore((s) => s.setRenderModalOpen);

  const sampleRateK = audioBuffer ? `${(audioBuffer.sampleRate / 1000).toFixed(1)}k` : '';
  const fileName = project?.audioFile.originalPath.split(/[/\\]/).pop() ?? '';
  const renderDisabled = !audioBuffer;

  const handleOpen = () => {
    if (project) void openProjectFromDialog();
    else void loadAudioFromDialog();
  };

  const handleSave = () => {
    if (!project) return;
    void saveCurrentProject();
  };

  return (
    <header className="h-full px-3 flex items-center gap-3 bg-[--bg-base]">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-[--accent]" aria-hidden />
        <span className="text-[16px] font-medium text-[--text-primary]">Spatialize</span>
        <span className="text-[10px] tracking-widest text-[--text-dim] font-mono">v1.4</span>
      </div>

      <nav className="flex items-center gap-3" aria-hidden>
        {(['File', 'Edit', 'Project', 'Render', 'View', 'Help'] as const).map((m) => (
          <span
            key={m}
            className="text-[12px] text-[--text-secondary] hover:text-[--text-primary] cursor-default select-none"
          >
            {m}
          </span>
        ))}
      </nav>

      <div className="flex-1 min-w-0 flex items-center justify-center gap-2.5 text-[12px]">
        {project ? (
          <>
            <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md bg-[--accent-soft] text-[--accent] flex-shrink-0">
              {project.settings.panningModel}
            </span>
            <span className="text-[--text-secondary] truncate max-w-[220px]">
              {project.meta.name}
            </span>
            <span className="font-mono text-[--text-dim] flex-shrink-0">{sampleRateK}</span>
            <span className="text-[--text-dim] flex-shrink-0">/</span>
            <span className="font-mono text-[--text-dim] flex-shrink-0">float32</span>
            <span className="text-[--text-dim] flex-shrink-0">·</span>
            <span className="text-[--text-secondary] truncate max-w-[260px]">{fileName}</span>
            {isDirty && (
              <span
                className="ml-1 text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md text-[--accent] border border-[--accent] flex-shrink-0"
                style={{ backgroundColor: 'rgba(248, 115, 40, 0.08)' }}
              >
                UNSAVED
              </span>
            )}
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!project}
          title="Save (⌘S)"
          className="text-[14px] px-3 py-1 rounded-md border border-[--accent] text-[--accent] hover:bg-[--accent-soft] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Save size={14} strokeWidth={1.75} />
          Save
        </button>
        <button
          type="button"
          onClick={handleOpen}
          title={project ? 'Open project (⌘O)' : 'Open audio (⌘I)'}
          className="text-[14px] px-3 py-1 rounded-md border border-[--accent] text-[--accent] hover:bg-[--accent-soft] flex items-center gap-1.5"
        >
          <FolderOpen size={14} strokeWidth={1.75} />
          Open
        </button>
        <div className="flex items-end gap-0.5 h-7 px-1.5" aria-label="VU meters L / R">
          <VuMeter analyser={AudioEngine.getAnalyserL()} />
          <VuMeter analyser={AudioEngine.getAnalyserR()} />
        </div>
        <button
          type="button"
          onClick={() => setRenderModalOpen(true)}
          disabled={renderDisabled}
          title="Render (⌘R)"
          className="text-[14px] px-4 py-1.5 rounded-md bg-[--accent] hover:bg-[--accent-hot] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Download size={14} strokeWidth={2} />
          Render
        </button>
      </div>
    </header>
  );
}
