import { FolderOpen, Save, Download } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '@/store/project-store';

const MENUS = ['File', 'Edit', 'Project', 'Render', 'View', 'Help'];

export function Topbar() {
  const project = useProjectStore((s) => s.project);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const loadAudioFile = useProjectStore((s) => s.loadAudioFile);

  const handleOpen = async () => {
    const picked = await open({
      multiple: false,
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'] }],
    });
    if (!picked || typeof picked !== 'string') return;
    const bytes = await readFile(picked);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await loadAudioFile(picked, arrayBuffer);
  };

  const sampleRateK = audioBuffer ? `${(audioBuffer.sampleRate / 1000).toFixed(1)}k` : '';
  const fileName = project?.audioFile.originalPath.split(/[/\\]/).pop() ?? '';
  const renderDisabled = !audioBuffer;

  return (
    <header className="h-full px-3 flex items-center gap-3 bg-[--bg-base]">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-[--accent]" aria-hidden />
        <span className="text-[16px] font-medium text-[--text-primary]">Spatialize</span>
      </div>

      <nav className="flex items-center gap-3 ml-2">
        {MENUS.map((m) => (
          <button
            key={m}
            type="button"
            className="text-[12px] text-[--text-secondary] hover:text-[--text-primary] transition-colors"
          >
            {m}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-0 flex items-center justify-center gap-2 text-[12px]">
        {project ? (
          <>
            <span className="text-[--accent] truncate max-w-[160px]">{project.meta.name}</span>
            <span className="font-mono text-[--text-secondary]">{sampleRateK}</span>
            <span className="text-[--text-dim]">·</span>
            <span className="text-[--text-secondary] truncate max-w-[260px]">{fileName}</span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          className="text-[14px] px-3 py-1 rounded-md border border-[--accent] text-[--accent] hover:bg-[--accent-soft] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Save size={14} strokeWidth={1.75} />
          Save
        </button>
        <button
          type="button"
          onClick={handleOpen}
          className="text-[14px] px-3 py-1 rounded-md border border-[--accent] text-[--accent] hover:bg-[--accent-soft] flex items-center gap-1.5"
        >
          <FolderOpen size={14} strokeWidth={1.75} />
          Open
        </button>
        <VuMeterPlaceholder />
        <button
          type="button"
          disabled={renderDisabled}
          className="text-[14px] px-4 py-1.5 rounded-md bg-[--accent] hover:bg-[--accent-hot] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Download size={14} strokeWidth={2} />
          Render
        </button>
      </div>
    </header>
  );
}

function VuMeterPlaceholder() {
  return (
    <div className="flex items-end gap-0.5 h-7 px-1.5" aria-label="VU meters (phase 5)">
      {(['L', 'R'] as const).map((ch) => (
        <div key={ch} className="flex flex-col gap-0.5 justify-end h-full">
          {Array.from({ length: 14 }).map((_, i) => {
            const fromTop = 13 - i;
            const color =
              fromTop === 0
                ? 'bg-[--vu-red]'
                : fromTop < 4
                  ? 'bg-[--vu-yellow]'
                  : 'bg-[--vu-green]';
            return <span key={i} className={`w-2 h-[1.5px] ${color} opacity-20`} />;
          })}
        </div>
      ))}
    </div>
  );
}
