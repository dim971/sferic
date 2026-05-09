function writeString(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

export type WavBitDepth = 16 | 24 | 32;

export interface WavOptions {
  bitDepth?: WavBitDepth;
  dither?: boolean;
}

// Triangular PDF dither, ±1 LSB worth, returned in the −1..+1 amplitude range
// (caller scales to the destination resolution).
function tpdf(): number {
  return Math.random() - Math.random();
}

export function encodeWav16(buffer: AudioBuffer): Uint8Array {
  return encodeWav(buffer, { bitDepth: 16, dither: false });
}

export function encodeWav(buffer: AudioBuffer, options: WavOptions = {}): Uint8Array {
  const bitDepth: WavBitDepth = options.bitDepth ?? 16;
  const dither = options.dither ?? false;
  const isFloat = bitDepth === 32;
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const dataSize = samples * numChannels * bytesPerSample;
  const totalSize = 44 + dataSize;
  const out = new ArrayBuffer(totalSize);
  const view = new DataView(out);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, isFloat ? 3 : 1, true); // 1 = PCM, 3 = IEEE float
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  if (bitDepth === 16) {
    const ditherScale = 1 / 0x8000;
    for (let i = 0; i < samples; i++) {
      for (let c = 0; c < numChannels; c++) {
        let s = channels[c][i];
        if (dither) s += tpdf() * ditherScale;
        s = Math.max(-1, Math.min(1, s));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
  } else if (bitDepth === 24) {
    for (let i = 0; i < samples; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, channels[c][i]));
        const intVal = s < 0 ? Math.round(s * 0x800000) : Math.round(s * 0x7fffff);
        const u = intVal < 0 ? intVal + 0x1000000 : intVal;
        view.setUint8(offset, u & 0xff);
        view.setUint8(offset + 1, (u >> 8) & 0xff);
        view.setUint8(offset + 2, (u >> 16) & 0xff);
        offset += 3;
      }
    }
  } else {
    // 32-bit IEEE float, no clipping — let DAWs handle headroom.
    for (let i = 0; i < samples; i++) {
      for (let c = 0; c < numChannels; c++) {
        view.setFloat32(offset, channels[c][i], true);
        offset += 4;
      }
    }
  }
  return new Uint8Array(out);
}
