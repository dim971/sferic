import { Plus, Minus } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { StatusBar } from '@/components/layout/StatusBar';
import { TransportBar, InsertKeyframeButton } from '@/components/transport/TransportBar';
import { BpmDisplay } from '@/components/transport/BpmDisplay';
import { BarBeatDisplay } from '@/components/transport/BarBeatDisplay';
import { MonitoringToggle } from '@/components/transport/MonitoringToggle';
import { MeterBar } from '@/components/transport/MeterBar';
import { Readouts } from '@/components/timeline/Readouts';
import { Waveform } from '@/components/timeline/Waveform';
import { Ruler } from '@/components/timeline/Ruler';
import { OrthographicView } from '@/components/scene/OrthographicView';
import { PerspectiveScene } from '@/components/scene/PerspectiveScene';
import { Box, Square } from 'lucide-react';
import { Inspector } from '@/components/inspector/Inspector';
import { RenderModal } from '@/components/render/RenderModal';
import { ShortcutsHelp } from '@/components/help/ShortcutsHelp';
import { AudioEngine } from '@/lib/audio-engine';
import { useProjectStore } from '@/store/project-store';
import { useTransportSync } from '@/lib/use-transport-sync';
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts';
import { useMenuEvents } from '@/lib/use-menu-events';

export default function App() {
  useTransportSync();
  useKeyboardShortcuts();
  useMenuEvents();
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const project = useProjectStore((s) => s.project);
  const renderModalOpen = useProjectStore((s) => s.renderModalOpen);
  const shortcutsOpen = useProjectStore((s) => s.shortcutsOpen);
  const setRenderModalOpen = useProjectStore((s) => s.setRenderModalOpen);
  const setShortcutsOpen = useProjectStore((s) => s.setShortcutsOpen);
  const viewMode = useProjectStore((s) => s.viewMode);
  const setViewMode = useProjectStore((s) => s.setViewMode);
  const duration = audioBuffer?.duration ?? 0;

  return (
    <div className="h-screen w-screen grid grid-rows-[44px_1fr_220px_22px] grid-cols-[1fr_1fr_320px] bg-[--bg-base] text-[--text-primary]">
      <div className="col-span-3 border-b border-[--border-subtle]">
        <Topbar />
      </div>

      {audioBuffer ? (
        viewMode === '2d' ? (
          <>
            <div className="relative">
              <OrthographicView projection="top" />
              <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
            </div>
            <div className="border-l border-[--border-subtle] min-h-0 min-w-0">
              <OrthographicView projection="side" />
            </div>
          </>
        ) : (
          <div className="col-span-2 relative min-h-0 min-w-0">
            <PerspectiveScene />
            <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        )
      ) : (
        <div className="col-span-2 bg-[--bg-panel] border-r border-[--border-subtle] flex items-center justify-center text-[--text-dim] text-[12px]">
          Open an audio file to begin — File ▸ Open audio…  (⌘I)
        </div>
      )}

      <div className="bg-[--bg-panel] border-l border-[--border-subtle] min-h-0">
        <Inspector />
      </div>

      <div className="col-span-3 bg-[--bg-panel] border-t border-[--border-subtle] flex flex-col gap-2 px-3 py-2 min-h-0">
        {/* Top control row — all on one horizontal line per design */}
        <div className="flex items-center gap-4 flex-wrap">
          <TransportBar />
          <span className="w-px h-6 bg-[--border-subtle]" aria-hidden />
          {project && <Readouts />}
          <span className="w-px h-6 bg-[--border-subtle]" aria-hidden />
          <BpmDisplay />
          <BarBeatDisplay />
          <span className="w-px h-6 bg-[--border-subtle]" aria-hidden />
          <MonitoringToggle />
          <InsertKeyframeButton />
        </div>

        {/* Waveform area */}
        <div className="flex-1 flex gap-2 min-h-0">
          <div className="flex-1 flex flex-col gap-1 min-w-0 min-h-0">
            <div className="flex-1 min-h-0">
              <Waveform audioBuffer={audioBuffer} />
            </div>
            <Ruler duration={duration} />
          </div>
          <div className="flex flex-col items-end justify-between gap-1.5 min-w-[110px]">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] tracking-widest uppercase font-mono text-[--text-dim]">L</span>
                <MeterBar analyser={AudioEngine.getAnalyserL()} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] tracking-widest uppercase font-mono text-[--text-dim]">R</span>
                <MeterBar analyser={AudioEngine.getAnalyserR()} />
              </div>
            </div>
            <ZoomControls />
            <span className="font-mono text-[10px] text-[--text-dim] tabular-nums">
              {project ? `${project.keyframes.length} kf` : '0 kf'}
            </span>
          </div>
        </div>
      </div>

      <div className="col-span-3">
        <StatusBar />
      </div>

      {renderModalOpen && audioBuffer && project && (
        <RenderModal onClose={() => setRenderModalOpen(false)} />
      )}
      {shortcutsOpen && <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}

function ZoomControls() {
  const zoom = useProjectStore((s) => s.waveformZoom);
  const setZoom = useProjectStore((s) => s.setWaveformZoom);
  return (
    <div className="flex items-center gap-1 text-[--text-dim]">
      <button
        type="button"
        onClick={() => setZoom(zoom / 1.5)}
        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-[--bg-panel-elev]"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={12} />
      </button>
      <span className="font-mono text-[10px] tabular-nums w-10 text-center">{Math.round(zoom)}px/s</span>
      <button
        type="button"
        onClick={() => setZoom(zoom * 1.5)}
        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-[--bg-panel-elev]"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

function ViewModeToggle({
  viewMode,
  setViewMode,
}: {
  viewMode: '2d' | '3d';
  setViewMode: (mode: '2d' | '3d') => void;
}) {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-md border border-[--border-strong] bg-[--bg-panel-elev]/90 backdrop-blur p-0.5 text-[10px] tracking-widest uppercase font-mono">
      <button
        type="button"
        onClick={() => setViewMode('2d')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
          viewMode === '2d'
            ? 'bg-[--accent] text-white'
            : 'text-[--text-dim] hover:text-[--text-secondary]'
        }`}
      >
        <Square size={10} strokeWidth={2} />
        2D
      </button>
      <button
        type="button"
        onClick={() => setViewMode('3d')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
          viewMode === '3d'
            ? 'bg-[--accent] text-white'
            : 'text-[--text-dim] hover:text-[--text-secondary]'
        }`}
      >
        <Box size={10} strokeWidth={2} />
        3D
      </button>
    </div>
  );
}
