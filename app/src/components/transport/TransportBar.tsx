import { Play, Pause, Plus, Square } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TransportBar() {
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const isPlaying = useProjectStore((s) => s.playback.isPlaying);
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const masterGain = useProjectStore((s) => s.masterGain);
  const play = useProjectStore((s) => s.play);
  const pause = useProjectStore((s) => s.pause);
  const stop = useProjectStore((s) => s.stop);
  const setMasterGain = useProjectStore((s) => s.setMasterGain);
  const insertKeyframe = useProjectStore((s) => s.insertKeyframeAtCurrent);

  const disabled = !audioBuffer;

  return (
    <div className="flex items-center gap-2 h-8">
      <button
        type="button"
        onClick={isPlaying ? pause : play}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[--accent] hover:bg-[--accent-soft] disabled:opacity-40 disabled:cursor-not-allowed data-[active=true]:bg-[--accent-soft]"
        data-active={isPlaying}
      >
        {isPlaying ? (
          <Pause size={16} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play size={16} fill="currentColor" strokeWidth={0} />
        )}
      </button>
      <button
        type="button"
        onClick={stop}
        disabled={disabled}
        aria-label="Stop"
        className="w-7 h-7 flex items-center justify-center rounded-md text-[--accent] hover:bg-[--accent-soft] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Square size={16} fill="currentColor" strokeWidth={0} />
      </button>
      <span className="font-mono text-[14px] text-[--text-primary] tabular-nums min-w-[44px] pl-1">
        {formatTime(currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={1.5}
        step={0.01}
        value={masterGain}
        onChange={(e) => setMasterGain(parseFloat(e.currentTarget.value))}
        disabled={disabled}
        aria-label="Volume"
        className="w-20 accent-[--accent] disabled:opacity-40"
      />
      <button
        type="button"
        onClick={() => insertKeyframe()}
        disabled={disabled}
        title="Insert keyframe at current time"
        className="ml-1 flex items-center gap-1 text-[11px] tracking-widest uppercase px-2 py-1 rounded-md bg-[--accent] text-white hover:bg-[--accent-hot] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={12} strokeWidth={2.25} />
        Keyframe
      </button>
    </div>
  );
}
