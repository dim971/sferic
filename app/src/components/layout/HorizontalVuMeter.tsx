import { useEffect, useRef, useState } from 'react';

interface HorizontalVuMeterProps {
  analyser: AnalyserNode | null;
}

const SEGMENTS = 12;
const SEG_W = 5;
const SEG_H = 8;
const SEG_GAP = 1;

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
      peakRef.current = Math.max(max, peakRef.current * 0.9);
      const segs = Math.min(SEGMENTS, Math.round(peakRef.current * SEGMENTS * 1.3));
      setLit(segs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return (
    <div
      style={{
        display: 'flex',
        gap: SEG_GAP,
        alignItems: 'center',
        flexShrink: 0,
      }}
      aria-hidden
    >
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const isOn = i < lit;
        const color =
          i >= SEGMENTS - 1
            ? '#E0533C'
            : i >= SEGMENTS - 3
              ? '#E0B341'
              : '#22A858';
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: SEG_W,
              height: SEG_H,
              borderRadius: 1,
              background: color,
              opacity: isOn ? 1 : 0.22,
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
