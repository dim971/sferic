import { useEffect, useRef, useState } from 'react';

interface VuMeterProps {
  analyser: AnalyserNode | null;
}

const SEGMENTS = 14;

export function VuMeter({ analyser }: VuMeterProps) {
  const [lit, setLit] = useState(0);
  const peakRef = useRef(0);

  useEffect(() => {
    if (!analyser) {
      setLit(0);
      return;
    }
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let max = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > max) max = v;
      }
      // Soft decay so the bar doesn't snap to zero between buffer chunks.
      peakRef.current = Math.max(max, peakRef.current * 0.92);
      const segs = Math.min(SEGMENTS, Math.round(peakRef.current * SEGMENTS * 1.2));
      setLit(segs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return (
    <div className="flex flex-col gap-0.5 justify-end h-7" aria-hidden>
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const fromTop = SEGMENTS - 1 - i;
        const isOn = fromTop < lit;
        const color =
          fromTop === 0
            ? 'bg-[--vu-red]'
            : fromTop < 4
              ? 'bg-[--vu-yellow]'
              : 'bg-[--vu-green]';
        return (
          <span
            key={i}
            className={`w-2 h-[1.5px] ${color} ${isOn ? 'opacity-100' : 'opacity-20'}`}
          />
        );
      })}
    </div>
  );
}
