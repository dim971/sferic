import { useEffect, useRef, useState } from 'react';

interface VuMeterProps {
  analyser: AnalyserNode | null;
}

const SEGMENTS = 12;

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
      peakRef.current = Math.max(max, peakRef.current * 0.92);
      const segs = Math.min(SEGMENTS, Math.round(peakRef.current * SEGMENTS * 1.2));
      setLit(segs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return (
    <div className="flex flex-col gap-[1px] justify-end h-7" aria-hidden>
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const fromTop = SEGMENTS - 1 - i;
        const isOn = fromTop < lit;
        const color =
          fromTop === 0
            ? 'bg-[--vu-red]'
            : fromTop < 3
              ? 'bg-[--vu-yellow]'
              : 'bg-[--vu-green]';
        return (
          <span
            key={i}
            className={`w-2.5 h-[2px] rounded-[1px] ${color} ${isOn ? 'opacity-100' : 'opacity-25'}`}
          />
        );
      })}
    </div>
  );
}
