import { Line } from '@react-three/drei';
import type { SpatialKeyframe } from '@/types/project';
import { samplePath } from '@/lib/math3d';

interface TrajectoryLineProps {
  keyframes: SpatialKeyframe[];
}

export function TrajectoryLine({ keyframes }: TrajectoryLineProps) {
  if (keyframes.length < 2) return null;
  const points = samplePath(keyframes, 64).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  if (points.length === 0) return null;
  return <Line points={points} color="#F87328" lineWidth={2} transparent opacity={0.6} />;
}
