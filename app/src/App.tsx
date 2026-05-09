import { Plus, Minus } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { TransportBar } from '@/components/transport/TransportBar';
import { BpmDisplay } from '@/components/transport/BpmDisplay';
import { BarBeatDisplay } from '@/components/transport/BarBeatDisplay';
import { MonitoringToggle } from '@/components/transport/MonitoringToggle';
import { MeterBar } from '@/components/transport/MeterBar';
import { Readouts } from '@/components/timeline/Readouts';
import { Waveform } from '@/components/timeline/Waveform';
import { Ruler } from '@/components/timeline/Ruler';
import { OrthographicView } from '@/components/scene/OrthographicView';
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
  const duration = audioBuffer?.duration ?? 0;

  return (
    <div className="h-screen w-screen grid grid-rows-[44px_1fr_180px] grid-cols-[1fr_1fr_320px] bg-[--bg-base] text-[--text-primary]">
      <div className="col-span-3 border-b border-[--border-subtle]">
        <Topbar />
      </div>

      {audioBuffer ? (
        <>
          <OrthographicView projection="top" />
          <div className="border-l border-[--border-subtle] min-h-0 min-w-0">
            <OrthographicView projection="side" />
          </div>
        </>
      ) : (
        <div className="col-span-2 bg-[--bg-panel] border-r border-[--border-subtle] flex items-center justify-center text-[--text-dim] text-[12px]">
          Charge un fichier audio pour commencer
        </div>
      )}

      <div className="bg-[--bg-panel] border-l border-[--border-subtle] min-h-0">
        <Inspector />
      </div>

      <div className="col-span-3 bg-[--bg-panel] border-t border-[--border-subtle] grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2 items-stretch">
        <div className="flex flex-col gap-1.5 justify-between min-w-[200px]">
          <TransportBar />
          {project && <Readouts />}
          <div className="flex items-center gap-3">
            <BpmDisplay />
            <BarBeatDisplay />
            <MonitoringToggle />
          </div>
        </div>
        <div className="flex flex-col gap-1 min-w-0">
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
          <div className="flex items-center gap-1 text-[--text-dim]">
            <button
              type="button"
              className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-[--bg-panel-elev]"
              aria-label="Zoom out"
            >
              <Minus size={12} />
            </button>
            <button
              type="button"
              className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-[--bg-panel-elev]"
              aria-label="Zoom in"
            >
              <Plus size={12} />
            </button>
            <span className="font-mono text-[10px] text-[--text-dim] tabular-nums ml-1">
              {project ? `${project.keyframes.length} kf` : ''}
            </span>
          </div>
        </div>
      </div>

      {renderModalOpen && audioBuffer && project && (
        <RenderModal onClose={() => setRenderModalOpen(false)} />
      )}
      {shortcutsOpen && <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
