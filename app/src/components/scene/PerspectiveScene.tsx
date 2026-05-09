import { Suspense, useMemo } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import { Box3, Raycaster, Sphere, Vector2, Vector3 } from 'three';
import type { SpatialKeyframe } from '@/types/project';
import { useProjectStore } from '@/store/project-store';
import { interpolatePosition, samplePath, cartesianToSpherical } from '@/lib/math3d';

const LISTENER_MODEL_URL = '/models/human_head.glb';
useGLTF.preload(LISTENER_MODEL_URL);

function formatTimecode(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PerspectiveScene() {
  const project = useProjectStore((s) => s.project);
  const orbitEnabled = useProjectStore((s) => s.orbitEnabled);
  const audioBuffer = useProjectStore((s) => s.audioBuffer);
  const addKeyframe = useProjectStore((s) => s.addKeyframe);
  const currentTime = useProjectStore((s) => s.playback.currentTime);
  const sortedKfs = useMemo(
    () => [...(project?.keyframes ?? [])].sort((a, b) => a.time - b.time),
    [project],
  );
  const sourcePos = interpolatePosition(sortedKfs, currentTime);
  const sph = cartesianToSpherical(sourcePos);

  const handleSphereClick = (e: ThreeEvent<PointerEvent>) => {
    if (!audioBuffer) return;
    e.stopPropagation();
    const p = e.point;
    const len = Math.hypot(p.x, p.y, p.z) || 1;
    addKeyframe({ x: p.x / len, y: p.y / len, z: p.z / len });
  };

  return (
    <div className="relative h-full w-full bg-[var(--bg-panel)]">
      <div className="absolute top-2 left-3 z-10 text-[11px] font-mono tabular-nums text-[var(--text-secondary)] pointer-events-none">
        <span className="tracking-widest uppercase text-[var(--text-dim)]">PERSPECTIVE</span>
        <span className="text-[var(--text-dim)] ml-2">3D</span>
      </div>
      <div className="absolute top-2 right-3 z-10 text-[11px] font-mono text-[var(--text-secondary)] pointer-events-none">
        {formatTimecode(currentTime)}
      </div>
      <Canvas
        camera={{ position: [2.5, 1.5, 2.5], fov: 50 }}
        className="h-full w-full"
        style={{ background: 'transparent' }}
      >
        {/* 3-point lighting setup gives the model real form */}
        <ambientLight intensity={0.18} color="#ffffff" />
        {/* Key — warm and bright from upper-right */}
        <directionalLight position={[3, 4, 2]} intensity={2.2} color="#fff1e6" />
        {/* Fill — cool and softer from upper-left */}
        <directionalLight position={[-3, 2, 1]} intensity={0.9} color="#a8c8ff" />
        {/* Rim — defines silhouette from behind */}
        <directionalLight position={[0, 1, -4]} intensity={1.4} color="#ffb273" />

        {/* Wireframe sphere — mesh has handler so it catches click-to-add */}
        <mesh onPointerDown={handleSphereClick}>
          <sphereGeometry args={[1, 24, 18]} />
          <meshBasicMaterial color="#F87328" wireframe transparent opacity={0.18} />
        </mesh>

        {/* Reference rings on the equator/meridians for orientation */}
        <RefRings />

        {/* Listener at origin — use head model in 3D, fallback to cone+sphere */}
        <Suspense fallback={<ListenerFallback />}>
          <ListenerHead />
        </Suspense>

        {/* Trajectory line */}
        {sortedKfs.length > 1 && <Trajectory keyframes={sortedKfs} />}

        {/* Keyframes */}
        {sortedKfs.map((kf, i) => (
          <KeyframeMarker3D key={kf.id} keyframe={kf} num={i + 1} />
        ))}

        {/* Live source cursor */}
        {sortedKfs.length > 0 && (
          <group position={[sourcePos.x, sourcePos.y, sourcePos.z]}>
            <mesh>
              <sphereGeometry args={[0.04, 16, 12]} />
              <meshBasicMaterial color="#FFD9B8" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.12, 16, 12]} />
              <meshBasicMaterial
                color="#FF8A3D"
                transparent
                opacity={0.25}
                depthWrite={false}
              />
            </mesh>
          </group>
        )}

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={2}
          maxDistance={8}
          enabled={orbitEnabled}
        />
      </Canvas>
      <div className="absolute bottom-2 left-3 z-10 font-mono text-[10px] tabular-nums text-[var(--text-dim)] pointer-events-none">
        cur az {sph.az >= 0 ? '+' : ''}
        {sph.az.toFixed(0)}° · el {sph.el >= 0 ? '+' : ''}
        {sph.el.toFixed(0)}° · r {sph.r.toFixed(2)}
      </div>
    </div>
  );
}

function RefRings() {
  return (
    <group>
      {/* equator (XZ plane) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.999, 1.001, 64]} />
        <meshBasicMaterial color="#2f333d" side={2} />
      </mesh>
      {/* prime meridian (XY plane) */}
      <mesh>
        <ringGeometry args={[0.999, 1.001, 64]} />
        <meshBasicMaterial color="#1f222a" side={2} />
      </mesh>
      {/* side meridian (YZ plane) */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.999, 1.001, 64]} />
        <meshBasicMaterial color="#1f222a" side={2} />
      </mesh>
    </group>
  );
}

function ListenerFallback() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.05, 20, 14]} />
        <meshBasicMaterial color="#4F8EF7" />
      </mesh>
      <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.025, 0.06, 12]} />
        <meshBasicMaterial color="#4F8EF7" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function ListenerHead() {
  const gltf = useGLTF(LISTENER_MODEL_URL);
  // Auto-scale the model so its longest dimension fits ~0.22 world units
  // (about a real head sitting at the centre of a unit-radius sphere).
  const { scale, offsetY } = useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const size = new Vector3();
    box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const target = 0.24;
    const s = target / longest;
    // Recenter vertically so eyes/ears land near the origin.
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

function Trajectory({ keyframes }: { keyframes: SpatialKeyframe[] }) {
  const points = useMemo(() => samplePath(keyframes, 96).map((p) => [p.x, p.y, p.z] as [number, number, number]), [keyframes]);
  if (points.length < 2) return null;
  return <Line points={points} color="#F87328" lineWidth={2} transparent opacity={0.65} />;
}

interface KeyframeMarker3DProps {
  keyframe: SpatialKeyframe;
  num: number;
}

function KeyframeMarker3D({ keyframe, num }: KeyframeMarker3DProps) {
  const selectKeyframe = useProjectStore((s) => s.selectKeyframe);
  const updateKeyframe = useProjectStore((s) => s.updateKeyframe);
  const setOrbitEnabled = useProjectStore((s) => s.setOrbitEnabled);
  const selected = useProjectStore((s) => s.selectedKeyframeId === keyframe.id);
  const { camera, gl } = useThree();
  const radius = selected ? 0.07 : 0.05;

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
          <sphereGeometry args={[0.16, 16, 12]} />
          <meshBasicMaterial color="#F87328" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <span
          className="text-[10px] text-white font-mono select-none"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
        >
          {num}
        </span>
      </Html>
    </group>
  );
}
