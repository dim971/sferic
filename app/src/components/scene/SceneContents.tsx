import type { ThreeEvent } from '@react-three/fiber';
import { useProjectStore } from '@/store/project-store';
import { interpolatePosition } from '@/lib/math3d';
import { Listener } from './Listener';
import { Source } from './Source';
import { KeyframeMarker } from './KeyframeMarker';
import { TrajectoryLine } from './TrajectoryLine';

interface SceneContentsProps {
  onSphereClick?: (e: ThreeEvent<PointerEvent>) => void;
}

export function SceneContents({ onSphereClick }: SceneContentsProps) {
  const project = useProjectStore((s) => s.project);
  const keyframes = project?.keyframes ?? [];
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const sourcePos = interpolatePosition(keyframes, currentTime);

  return (
    <>
      <ambientLight intensity={0.5} />
      <mesh onPointerDown={onSphereClick}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshBasicMaterial color="#F87328" wireframe transparent opacity={0.18} />
      </mesh>
      <Listener />
      <TrajectoryLine keyframes={keyframes} />
      <Source position={sourcePos} />
      {keyframes.map((kf, i) => (
        <KeyframeMarker key={kf.id} keyframe={kf} index={i + 1} />
      ))}
    </>
  );
}
