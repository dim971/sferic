import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useProjectStore } from '@/store/project-store';
import { SceneContents } from './SceneContents';

export function ScenePerspective() {
  const addKeyframe = useProjectStore((s) => s.addKeyframe);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const orbitEnabled = useProjectStore((s) => s.orbitEnabled);

  const handleSphereClick = (e: ThreeEvent<PointerEvent>) => {
    if (!audioBuffer) return;
    e.stopPropagation();
    const p = e.point;
    const len = Math.hypot(p.x, p.y, p.z) || 1;
    addKeyframe({ x: p.x / len, y: p.y / len, z: p.z / len });
  };

  return (
    <Canvas camera={{ position: [2.5, 2, 2.5], fov: 50 }} className="bg-[--bg-panel]">
      <SceneContents onSphereClick={handleSphereClick} />
      <OrbitControls makeDefault enablePan={false} minDistance={2} maxDistance={8} enabled={orbitEnabled} />
    </Canvas>
  );
}
