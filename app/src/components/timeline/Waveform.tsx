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

  useEffect(() => {
    if (!audioBuffer || !containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#F87328',
      progressColor: '#FF8A3D',
      cursorColor: '#FFFFFF',
      cursorWidth: 1,
      barWidth: 1,
      barGap: 1,
      barRadius: 0,
      height: 96,
      interact: false,
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
  }, [audioBuffer]);

  useEffect(() => {
    if (wsRef.current && duration > 0) {
      wsRef.current.setTime(Math.min(currentTime, duration));
    }
  }, [currentTime, duration]);

  if (!audioBuffer) {
    return (
      <div className="h-24 flex items-center justify-center text-[--text-dim] text-[12px]">
        Aucun fichier chargé
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
    <div
      className="relative bg-[--waveform-bg] rounded-md cursor-crosshair"
      onClick={handleClick}
    >
      <div ref={containerRef} />
      <div className="absolute inset-0 pointer-events-none">
        {keyframes.map((kf) => {
          const left = duration > 0 ? (kf.time / duration) * 100 : 0;
          const isSel = kf.id === selectedId;
          return (
            <div
              key={kf.id}
              className="absolute top-0 bottom-0 pointer-events-auto group"
              style={{ left: `${left}%` }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  selectKeyframe(kf.id);
                }}
                className={`absolute top-0 bottom-0 -translate-x-1/2 w-1 ${
                  isSel ? 'bg-[--accent] opacity-100' : 'bg-[--accent] opacity-50 hover:opacity-100'
                }`}
                aria-label={`Keyframe at ${kf.time.toFixed(2)}s`}
              />
              {isSel && (
                <>
                  <div className="absolute -top-0 -translate-x-1/2 w-2 h-2 rotate-45 bg-[--accent]" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeKeyframe(kf.id);
                    }}
                    className="absolute -top-5 -translate-x-1/2 w-4 h-4 rounded-full bg-[--bg-panel-elev] text-[--vu-red] flex items-center justify-center opacity-0 group-hover:opacity-100"
                    aria-label="Remove keyframe"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
