import { Html } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Raycaster, Sphere, Vector2, Vector3 } from 'three';
import { useMemo } from 'react';
import type { SpatialKeyframe } from '@/types/project';
import { useProjectStore } from '@/store/project-store';

interface KeyframeMarkerProps {
  keyframe: SpatialKeyframe;
  index: number;
}

export function KeyframeMarker({ keyframe, index }: KeyframeMarkerProps) {
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);
  const updateKeyframe = useProjectStore((s) => s.updateKeyframe);
  const setOrbitEnabled = useProjectStore((s) => s.setOrbitEnabled);
  const selected = useProjectStore((s) => s.selectedKeyframeId === keyframe.id);
  const { camera, gl } = useThree();

  const radius = selected ? 0.08 : 0.05;

  const tools = useMemo(
    () => ({
      raycaster: new Raycaster(),
      sphere: new Sphere(new Vector3(0, 0, 0), 1),
      pointer: new Vector2(),
      target: new Vector3(),
    }),
    [],
  );

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    selectKeyframe(keyframe.id);
    setOrbitEnabled(false);

    const onMove = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      tools.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      tools.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      tools.raycaster.setFromCamera(tools.pointer, camera);
      if (tools.raycaster.ray.intersectSphere(tools.sphere, tools.target)) {
        const len = tools.target.length() || 1;
        updateKeyframe(keyframe.id, {
          position: { x: tools.target.x / len, y: tools.target.y / len, z: tools.target.z / len },
        });
      }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setOrbitEnabled(true);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
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
