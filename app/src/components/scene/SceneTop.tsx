import { Canvas } from '@react-three/fiber';
import { SceneContents } from './SceneContents';

export function SceneTop() {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 5, 0.0001], zoom: 200, near: 0.1, far: 100, up: [0, 0, -1] }}
      className="bg-[--bg-panel]"
    >
      <SceneContents />
    </Canvas>
  );
}
