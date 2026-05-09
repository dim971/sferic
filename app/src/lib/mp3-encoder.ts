import lamejs from '@breezystack/lamejs';

function floatToInt16(arr: Float32Array): Int16Array {
  const out = new Int16Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const s = Math.max(-1, Math.min(1, arr[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export type Mp3Bitrate = 128 | 192 | 256 | 320;

export function encodeMp3(buffer: AudioBuffer, kbps: Mp3Bitrate = 320): Uint8Array {
  const channels = Math.min(2, buffer.numberOfChannels);
  const encoder = new lamejs.Mp3Encoder(channels, buffer.sampleRate, kbps);
  const left = floatToInt16(buffer.getChannelData(0));
  const right =
    channels > 1 ? floatToInt16(buffer.getChannelData(1)) : left;

  const blockSize = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right.subarray(i, i + blockSize);
    const buf =
      channels > 1
        ? encoder.encodeBuffer(l, r)
        : encoder.encodeBuffer(l);
    if (buf.length > 0) chunks.push(buf);
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);

  const total = chunks.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    result.set(c, off);
    off += c.length;
  }
  return result;
}
