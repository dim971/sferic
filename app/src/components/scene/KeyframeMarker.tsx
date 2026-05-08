import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { SpatialKeyframe } from '@/types/project';
import { useProjectStore } from '@/store/project-store';

interface KeyframeMarkerProps {
  keyframe: SpatialKeyframe;
  index: number;
}

export function KeyframeMarker({ keyframe, index }: KeyframeMarkerProps) {
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);
  const selected = useProjectStore((s) => s.selectedKeyframeId === keyframe.id);

  const radius = selected ? 0.08 : 0.05;

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    selectKeyframe(keyframe.id);
  };

  return (
    <group position={[keyframe.position.x, keyframe.position.y, keyframe.position.z]}>
      <mesh onPointerDown={handleDown}>
        <sphereGeometry args={[radius, 16, 12]} />
        <meshBasicMaterial color="#F87328" />
      </mesh>
      {selected && (
        <mesh>
          <sphereGeometry args={[0.18, 16, 12]} />
          <meshBasicMaterial color="#F87328" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <span
          className="text-[10px] text-white font-mono select-none"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
        >
          {index}
        </span>
      </Html>
    </group>
  );
}
