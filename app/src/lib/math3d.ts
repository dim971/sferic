import type { CurveType, SpatialKeyframe } from '@/types/project';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function applyCurve(t: number, curve: CurveType): number {
  switch (curve) {
    case 'linear':
      return t;
    case 'eaze':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'smooth':
      return t * t * (3 - 2 * t);
    case 'step':
      return t < 1 ? 0 : 1;
  }
}

export function interpolatePosition(keyframes: SpatialKeyframe[], timeSec: number): Vec3 {
  if (keyframes.length === 0) return { x: 0, y: 0, z: -1 };
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (timeSec <= sorted[0].time) return sorted[0].position;
  const last = sorted[sorted.length - 1];
  if (timeSec >= last.time) return last.position;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (timeSec >= a.time && timeSec <= b.time) {
      const raw = (timeSec - a.time) / (b.time - a.time);
      const t = applyCurve(raw, b.curve);
      return {
        x: a.position.x + (b.position.x - a.position.x) * t,
        y: a.position.y + (b.position.y - a.position.y) * t,
        z: a.position.z + (b.position.z - a.position.z) * t,
      };
    }
  }
  return last.position;
}

export function samplePath(keyframes: SpatialKeyframe[], segments = 64): Vec3[] {
  if (keyframes.length < 2) return [];
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const t0 = sorted[0].time;
  const t1 = sorted[sorted.length - 1].time;
  const span = t1 - t0;
  if (span <= 0) return [];
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = t0 + (span * i) / segments;
    points.push(interpolatePosition(sorted, t));
  }
  return points;
}

export function cartesianToSpherical(p: Vec3): { az: number; el: number; r: number } {
  const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  if (r === 0) return { az: 0, el: 0, r: 0 };
  const az = (Math.atan2(p.x, -p.z) * 180) / Math.PI;
  const el = (Math.asin(p.y / r) * 180) / Math.PI;
  return { az, el, r };
}
