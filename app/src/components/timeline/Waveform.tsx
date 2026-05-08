import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface WaveformProps {
  audioBuffer: AudioBuffer | null;
}

export function Waveform({ audioBuffer }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

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

    return () => {
      ws.destroy();
    };
  }, [audioBuffer]);

  if (!audioBuffer) {
    return (
      <div className="h-24 flex items-center justify-center text-[--text-dim] text-[12px]">
        Aucun fichier chargé
      </div>
    );
  }

  return <div ref={containerRef} className="bg-[--waveform-bg] rounded-md" />;
}
