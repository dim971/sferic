import { Plus, Minus } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { TransportBar } from '@/components/transport/TransportBar';
import { Readouts } from '@/components/timeline/Readouts';
import { Waveform } from '@/components/timeline/Waveform';
import { Ruler } from '@/components/timeline/Ruler';
import { OrthographicView } from '@/components/scene/OrthographicView';
import { Inspector } from '@/components/inspector/Inspector';
import { useProjectStore } from '@/store/project-store';
import { useTransportSync } from '@/lib/use-transport-sync';
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts';

export default function App() {
  useTransportSync();
  useKeyboardShortcuts();
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const project = useProjectStore((s) => s.project);
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
        <div className="flex flex-col gap-1.5 justify-between min-w-[180px]">
          <TransportBar />
          {project && <Readouts />}
          <span className="text-[10px] font-mono text-[--text-dim] tabular-nums">
            Shift+clic = ajouter keyframe
          </span>
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex-1 min-h-0">
            <Waveform audioBuffer={audioBuffer} />
          </div>
          <Ruler duration={duration} />
        </div>
        <div className="flex flex-col items-end justify-between gap-1 min-w-[60px]">
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
          </div>
          <span className="font-mono text-[10px] text-[--text-dim] tabular-nums">
            {project ? `${project.keyframes.length} kf` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
