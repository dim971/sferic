import { useEffect, useState } from 'react';
import { AudioEngine } from '@/lib/audio-engine';

export function useCpuMonitor(): { cpu: number; bufferSize: number | null } {
  const [cpu, setCpu] = useState(0);
  const [bufferSize, setBufferSize] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCpu(AudioEngine.getCpuApproxPercent());
      setBufferSize(AudioEngine.getBufferSize());
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return { cpu, bufferSize };
}
