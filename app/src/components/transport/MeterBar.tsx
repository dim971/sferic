import { useEffect, useRef, useState } from 'react';
import { peakToDb, readPeak } from '@/lib/audio-analysis';

interface MeterBarProps {
  analyser: AnalyserNode | null;
  segments?: number;
  className?: string;
}

const MIN_DB = -60;
const RELEASE_DB_PER_FRAME = 1.5;

export function MeterBar({ analyser, segments = 12, className = '' }: MeterBarProps) {
  const [db, setDb] = useState(MIN_DB);
  const smoothed = useRef(MIN_DB);

  useEffect(() => {
    if (!analyser) {
      smoothed.current = MIN_DB;
      setDb(MIN_DB);
      return;
    }
    let raf = 0;
    const tick = () => {
      const target = peakToDb(readPeak(analyser));
      const t = Math.max(MIN_DB, target);
      if (t > smoothed.current) smoothed.current = t;
      else smoothed.current = Math.max(t, smoothed.current - RELEASE_DB_PER_FRAME);
      setDb(smoothed.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  const ratio = (db - MIN_DB) / -MIN_DB;
  const lit = Math.max(0, Math.min(segments, Math.round(ratio * segments * 1.05)));

  return (
    <div className={`flex items-center gap-[2px] ${className}`}>
      {Array.from({ length: segments }).map((_, i) => {
        const isOn = i < lit;
        const color =
          i >= segments - 1
            ? 'bg-[var(--vu-red)]'
            : i >= segments - 4
              ? 'bg-[var(--vu-yellow)]'
              : 'bg-[var(--vu-green)]';
        return (
          <span
            key={i}
            className={`h-1.5 w-1 ${color} ${isOn ? 'opacity-100' : 'opacity-15'}`}
          />
        );
      })}
    </div>
  );
}
