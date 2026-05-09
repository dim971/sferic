import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { useProjectStore } from '@/store/project-store';
import { interpolatePosition } from '@/lib/math3d';

interface WaveformProps {
  audioBuffer: AudioBuffer | null;
}

export function Waveform({ audioBuffer }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const selectedId = useProjectStore((s) => s.selectedKeyframeId);
  const seek = useProjectStore((s) => s.seek);
  const addKeyframe = useProjectStore((s) => s.addKeyframe);
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);
  const removeKeyframe = useProjectStore((s) => s.removeKeyframe);

  const keyframes = project?.keyframes ?? [];
  const duration = audioBuffer?.duration ?? 0;
  const isStereo = (audioBuffer?.numberOfChannels ?? 1) >= 2;

  useEffect(() => {
    if (!audioBuffer || !containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      cursorColor: '#FFFFFF',
      cursorWidth: 1,
      barWidth: 1,
      barGap: 1,
      barRadius: 0,
      height: isStereo ? 46 : 96,
      interact: false,
      normalize: false,
      splitChannels: isStereo
        ? [
            { waveColor: '#F87328', progressColor: '#FF8A3D' },
            { waveColor: '#A04C1A', progressColor: '#C8631F' },
          ]
        : undefined,
      waveColor: isStereo ? undefined : '#F87328',
      progressColor: isStereo ? undefined : '#FF8A3D',
    });

    const peaks: Float32Array[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      peaks.push(audioBuffer.getChannelData(c));
    }
    void ws.load('', peaks, audioBuffer.duration);
    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [audioBuffer, isStereo]);

  useEffect(() => {
    if (wsRef.current && duration > 0) {
      wsRef.current.setTime(Math.min(currentTime, duration));
    }
  }, [currentTime, duration]);

  if (!audioBuffer) {
    return (
      <div className="h-24 flex items-center justify-center text-[--text-dim] text-[10px] tracking-widest uppercase">
        no waveform
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = Math.max(0, Math.min((x / rect.width) * duration, duration));
    if (e.shiftKey) {
      const pos = interpolatePosition(keyframes, t);
      addKeyframe(pos, t);
    } else {
      seek(t);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <KeyframeDiamondRow
        keyframes={keyframes}
        duration={duration}
        selectedId={selectedId}
        onSelect={selectKeyframe}
        onRemove={removeKeyframe}
      />
      <div
        className="relative bg-[--waveform-bg] rounded-md cursor-crosshair flex-1 min-h-0"
        onClick={handleClick}
      >
        <div ref={containerRef} className="h-full" />
        <div className="absolute inset-0 pointer-events-none">
          {keyframes.map((kf) => {
            const left = duration > 0 ? (kf.time / duration) * 100 : 0;
            const isSel = kf.id === selectedId;
            return (
              <div
                key={kf.id}
                className="absolute top-0 bottom-0"
                style={{ left: `${left}%` }}
              >
                <span
                  className={`absolute top-0 bottom-0 -translate-x-1/2 w-px ${
                    isSel ? 'bg-[--accent] opacity-90' : 'bg-[--accent] opacity-30'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface KeyframeDiamondRowProps {
  keyframes: { id: string; time: number }[];
  duration: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

function KeyframeDiamondRow({
  keyframes,
  duration,
  selectedId,
  onSelect,
  onRemove,
}: KeyframeDiamondRowProps) {
  return (
    <div className="relative h-3 mb-1">
      {keyframes.map((kf) => {
        const left = duration > 0 ? (kf.time / duration) * 100 : 0;
        const isSel = kf.id === selectedId;
        return (
          <div
            key={kf.id}
            className="absolute top-0 -translate-x-1/2 group"
            style={{ left: `${left}%` }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(kf.id);
              }}
              aria-label={`Keyframe at ${kf.time.toFixed(2)}s`}
              className={`block w-2.5 h-2.5 rotate-45 transition-colors ${
                isSel
                  ? 'bg-[--accent] outline outline-1 outline-offset-1 outline-[--accent]'
                  : 'bg-[--accent] opacity-70 hover:opacity-100'
              }`}
            />
            {isSel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(kf.id);
                }}
                aria-label="Remove keyframe"
                className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[--bg-panel-elev] text-[--vu-red] flex items-center justify-center opacity-0 group-hover:opacity-100"
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
