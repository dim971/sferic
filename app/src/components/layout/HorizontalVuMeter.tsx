import { useEffect, useRef, useState } from 'react';

interface HorizontalVuMeterProps {
  analyser: AnalyserNode | null;
}

const SEGMENTS = 12;

export function HorizontalVuMeter({ analyser }: HorizontalVuMeterProps) {
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
    <div className="flex gap-px" aria-hidden>
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const isOn = i < lit;
        const color =
          i >= SEGMENTS - 1
            ? 'bg-[--vu-red]'
            : i >= SEGMENTS - 3
              ? 'bg-[--vu-yellow]'
              : 'bg-[--vu-green]';
        return (
          <span
            key={i}
            className={`w-1 h-[7px] rounded-[1px] ${color} ${isOn ? 'opacity-100' : 'opacity-25'}`}
          />
        );
      })}
    </div>
  );
}
