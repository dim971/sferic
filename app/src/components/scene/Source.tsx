import type { Vec3 } from '@/lib/math3d';

interface SourceProps {
  position: Vec3;
}

export function Source({ position }: SourceProps) {
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshBasicMaterial color="#F87328" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshBasicMaterial color="#F87328" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}
