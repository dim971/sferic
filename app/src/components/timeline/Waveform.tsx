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
  const loopEnabled = useProjectStore((s) => s.loopEnabled);
  const loopRegion = useProjectStore((s) => s.loopRegion);
  const setLoopRegion = useProjectStore((s) => s.setLoopRegion);
  const waveformZoom = useProjectStore((s) => s.waveformZoom);

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
      height: 'auto',
      interact: false,
      normalize: true,
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

  useEffect(() => {
    if (wsRef.current && waveformZoom > 0) {
      try {
        wsRef.current.zoom(waveformZoom);
      } catch {
        /* ignore — zoom may throw if buffer not ready */
      }
    }
  }, [waveformZoom, audioBuffer]);

  if (!audioBuffer) {
    return (
      <div className="h-24 flex items-center justify-center text-[--text-dim] text-[10px] tracking-widest uppercase">
        no waveform
      </div>
    );
  }

  const wavePointerRef = useRef<{ origin: number; start: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(((e.clientX - rect.left) / rect.width) * duration, duration));

    if (e.shiftKey) {
      const pos = interpolatePosition(keyframes, t);
      addKeyframe(pos, t);
      return;
    }

    if (e.altKey) {
      // Alt+drag defines a loop region (drag from start to end).
      const containerRect = rect;
      wavePointerRef.current = { origin: t, start: t };
      setLoopRegion({ start: t, end: Math.min(duration, t + 0.001) });
      const onMove = (ev: PointerEvent) => {
        const tt = Math.max(
          0,
          Math.min(((ev.clientX - containerRect.left) / containerRect.width) * duration, duration),
        );
        const ref = wavePointerRef.current;
        if (!ref) return;
        const start = Math.min(ref.origin, tt);
        const end = Math.max(ref.origin, tt);
        setLoopRegion({ start, end });
      };
      const onUp = () => {
        wavePointerRef.current = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      return;
    }

    seek(t);
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
        className="relative bg-[--waveform-bg] rounded-md cursor-crosshair flex-1 min-h-0 overflow-hidden"
        onPointerDown={handlePointerDown}
      >
        <div ref={containerRef} className="h-full" />
        <div className="absolute inset-0 pointer-events-none">
          {/* Loop region brackets and tinted band */}
          {loopRegion && duration > 0 && (
            <LoopRegionOverlay
              start={loopRegion.start}
              end={loopRegion.end}
              duration={duration}
              enabled={loopEnabled}
            />
          )}
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

interface LoopRegionOverlayProps {
  start: number;
  end: number;
  duration: number;
  enabled: boolean;
}

function LoopRegionOverlay({ start, end, duration, enabled }: LoopRegionOverlayProps) {
  if (duration <= 0 || end <= start) return null;
  const leftPct = (start / duration) * 100;
  const widthPct = ((end - start) / duration) * 100;
  const opacity = enabled ? 1 : 0.4;
  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none"
      style={{ left: `${leftPct}%`, width: `${widthPct}%`, opacity }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: enabled ? 'rgba(248, 115, 40, 0.08)' : 'rgba(248, 115, 40, 0.04)' }}
      />
      {/* Left bracket */}
      <div className="absolute top-0 bottom-0 left-0 flex flex-col">
        <span className="w-2 h-1 bg-[--accent]" />
        <span className="w-px h-full bg-[--accent]" />
        <span className="w-2 h-1 bg-[--accent]" />
      </div>
      {/* Right bracket */}
      <div className="absolute top-0 bottom-0 right-0 flex flex-col items-end">
        <span className="w-2 h-1 bg-[--accent]" />
        <span className="w-px h-full bg-[--accent]" />
        <span className="w-2 h-1 bg-[--accent]" />
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
    <div className="relative h-3 mb-1" data-row-keyframes>
      {keyframes.map((kf) => (
        <KeyframeDiamond
          key={kf.id}
          keyframe={kf}
          duration={duration}
          selected={kf.id === selectedId}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function KeyframeDiamond({
  keyframe,
  duration,
  selected,
  onSelect,
  onRemove,
}: {
  keyframe: { id: string; time: number };
  duration: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const updateKeyframe = useProjectStore((s) => s.updateKeyframe);
  const left = duration > 0 ? (keyframe.time / duration) * 100 : 0;

  const handleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(keyframe.id);
    if (duration <= 0) return;

    const rowEl =
      (e.currentTarget.closest('[data-row-keyframes]') as HTMLElement | null) ?? null;
    if (!rowEl) return;
    const rect = rowEl.getBoundingClientRect();
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      moved = true;
      const t = Math.max(0, Math.min(((ev.clientX - rect.left) / rect.width) * duration, duration));
      updateKeyframe(keyframe.id, { time: t });
    };
    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      // If never moved AND it was a click meant for delete (X button), the X has its own handler.
      void ev;
      void moved;
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className="absolute top-0 -translate-x-1/2 group"
      style={{ left: `${left}%` }}
    >
      <button
        type="button"
        onPointerDown={handleDown}
        aria-label={`Keyframe at ${keyframe.time.toFixed(2)}s — drag to move in time`}
        title={`${keyframe.time.toFixed(2)}s — drag to move`}
        className={`block w-2.5 h-2.5 rotate-45 transition-colors cursor-grab active:cursor-grabbing ${
          selected
            ? 'bg-[--accent] outline outline-1 outline-offset-1 outline-[--accent]'
            : 'bg-[--accent] opacity-70 hover:opacity-100'
        }`}
      />
      {selected && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(keyframe.id);
          }}
          aria-label="Remove keyframe"
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[--bg-panel-elev] text-[--vu-red] flex items-center justify-center opacity-0 group-hover:opacity-100"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
