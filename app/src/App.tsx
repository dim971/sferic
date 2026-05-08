import { Topbar } from '@/components/layout/Topbar';
import { TransportBar } from '@/components/transport/TransportBar';
import { Waveform } from '@/components/timeline/Waveform';
import { useProjectStore } from '@/store/project-store';
import { useTransportSync } from '@/lib/use-transport-sync';

export default function App() {
  useTransportSync();
  const audioBuffer = useProjectStore((s) => s.audioBuffer);

  return (
    <div className="h-screen w-screen grid grid-rows-[44px_1fr_180px] grid-cols-[1fr_320px] bg-[--bg-base] text-[--text-primary]">
      <div className="col-span-2 border-b border-[--border-subtle]">
        <Topbar />
      </div>

      <div className="bg-[--bg-panel] border-r border-[--border-subtle] flex items-center justify-center text-[--text-dim] text-[12px]">
        {audioBuffer
          ? `${audioBuffer.duration.toFixed(2)}s · ${audioBuffer.numberOfChannels}ch · ${audioBuffer.sampleRate}Hz`
          : 'Charge un fichier audio pour commencer'}
      </div>

      <div className="bg-[--bg-panel]" aria-label="Inspector placeholder" />

      <div className="col-span-2 bg-[--bg-panel] border-t border-[--border-subtle] grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2 items-center">
        <TransportBar />
        <Waveform audioBuffer={audioBuffer} />
        <div aria-label="Zoom controls placeholder" className="w-12" />
      </div>
    </div>
  );
}
