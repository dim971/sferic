import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import type { Projection } from '@/types/project';

const LISTENER_MODEL_URL = '/models/human_head.glb';
useGLTF.preload(LISTENER_MODEL_URL);

interface ListenerCanvasOverlayProps {
  projection: Projection;
}

export function ListenerCanvasOverlay({ projection }: ListenerCanvasOverlayProps) {
  // TOP view: camera straight above looking -Y, with -Z toward screen top.
  // SIDE view: camera from +X looking -X, head's -Z face appears on the LEFT.
  const cameraConfig =
    projection === 'top'
      ? ({
          position: [0, 1.2, 0.001] as [number, number, number],
          fov: 28,
          up: [0, 0, -1] as [number, number, number],
        })
      : ({
          position: [1.2, 0, 0] as [number, number, number],
          fov: 28,
          up: [0, 1, 0] as [number, number, number],
        });

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: '50%',
        left: '50%',
        width: 64,
        height: 64,
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden
    >
      <Canvas camera={cameraConfig} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.35} color="#ffffff" />
        <directionalLight position={[2, 3, 2]} intensity={1.6} color="#fff1e6" />
        <directionalLight position={[-2, 1, 1]} intensity={0.7} color="#a8c8ff" />
        <directionalLight position={[0, 0, -3]} intensity={0.9} color="#ffb273" />
        <Suspense fallback={null}>
          <HeadModel />
        </Suspense>
      </Canvas>
    </div>
  );
}

function HeadModel() {
  const gltf = useGLTF(LISTENER_MODEL_URL);
  const { scale, offsetY } = useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const size = new Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    // Slightly larger than in the 3D scene since the inset canvas
    // gets only a small viewport.
    const target = 0.7;
    const s = target / longest;
    const center = new Vector3();
    box.getCenter(center);
    return { scale: s, offsetY: -center.y * s };
  }, [gltf.scene]);

  return (
    <group rotation={[0, Math.PI, 0]} position={[0, offsetY, 0]} scale={scale}>
      <primitive object={gltf.scene} />
    </group>
  );
}
