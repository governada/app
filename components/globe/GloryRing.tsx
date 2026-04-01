/**
 * GloryRing — Golden torus ring around the #1 match result during reveal.
 *
 * Fades in, gently pulses in scale, and emits golden light via additive blending.
 */

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function GloryRing({
  target,
  active,
}: {
  target: [number, number, number] | null;
  active: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (active) startTimeRef.current = 0;
  }, [active]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current || !target || !active) {
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }

    const mesh = meshRef.current;
    const mat = materialRef.current;

    if (startTimeRef.current === 0) startTimeRef.current = clock.getElapsedTime();
    const elapsed = clock.getElapsedTime() - startTimeRef.current;

    const fadeIn = Math.min(elapsed / 0.5, 1);
    const pulse = 1 + Math.sin(elapsed * 3) * 0.15;

    mesh.visible = true;
    mesh.position.set(target[0], target[1], target[2]);
    mesh.scale.setScalar(pulse * fadeIn);
    mesh.rotation.x = Math.PI * 0.5 + Math.sin(elapsed * 0.8) * 0.08;
    mesh.rotation.z = elapsed * 0.3;
    mat.opacity = fadeIn * 0.5;
  });

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false}>
      <torusGeometry args={[0.5, 0.02, 12, 36]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#f5c542"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
