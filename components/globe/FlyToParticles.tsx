/**
 * FlyToParticles — Particle stream from camera to target on match reveal.
 *
 * 30 particles cascade from the camera position to the target node,
 * creating a dramatic reveal effect during match flow.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MATCH_COLOR } from '@/lib/globe/types';
import { PULSE_VERT, PULSE_FRAG } from '@/lib/globe/shaders';

const FLY_PARTICLE_COUNT = 30;

export function FlyToParticles({
  target,
  active,
}: {
  target: [number, number, number] | null;
  active: boolean;
}) {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const startTimesRef = useRef(new Float32Array(FLY_PARTICLE_COUNT));
  const activatedRef = useRef(false);
  const cameraStartRef = useRef<[number, number, number]>([0, 3, 14]);

  useEffect(() => {
    if (active && target) {
      activatedRef.current = true;
      for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
        startTimesRef.current[i] = -1;
      }
    } else {
      activatedRef.current = false;
    }
  }, [active, target]);

  useFrame(({ camera, clock }) => {
    const geo = geoRef.current;
    if (!geo || !target || !activatedRef.current) return;

    const positions = geo.getAttribute('position') as THREE.BufferAttribute | null;
    const alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute | null;
    if (!positions || !alphas) return;

    const now = clock.getElapsedTime();

    if (startTimesRef.current[0] < 0) {
      cameraStartRef.current = [camera.position.x, camera.position.y, camera.position.z];
      for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
        startTimesRef.current[i] = now + i * 0.03;
      }
    }

    const [sx, sy, sz] = cameraStartRef.current;
    const [tx, ty, tz] = target;
    let anyActive = false;

    for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
      const elapsed = now - startTimesRef.current[i];
      if (elapsed < 0) {
        positions.setXYZ(i, sx, sy, sz);
        alphas.setX(i, 0);
        anyActive = true;
        continue;
      }

      const t = Math.min(elapsed / 0.8, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      positions.setXYZ(i, sx + (tx - sx) * eased, sy + (ty - sy) * eased, sz + (tz - sz) * eased);

      const alpha = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1;
      alphas.setX(i, alpha * 0.8);

      if (t < 1) anyActive = true;
    }

    positions.needsUpdate = true;
    alphas.needsUpdate = true;

    if (!anyActive) {
      activatedRef.current = false;
    }
  });

  const buffers = useMemo(() => {
    const positions = new Float32Array(FLY_PARTICLE_COUNT * 3);
    const sizes = new Float32Array(FLY_PARTICLE_COUNT).fill(0.06);
    const alphas = new Float32Array(FLY_PARTICLE_COUNT).fill(0);
    const colors = new Float32Array(FLY_PARTICLE_COUNT * 3);
    const matchCol = new THREE.Color(MATCH_COLOR);
    for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
      colors[i * 3] = matchCol.r * 2.5;
      colors[i * 3 + 1] = matchCol.g * 2.5;
      colors[i * 3 + 2] = matchCol.b * 2.5;
    }
    return { positions, sizes, alphas, colors };
  }, []);

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[buffers.sizes, 1]} />
        <bufferAttribute attach="attributes-aAlpha" args={[buffers.alphas, 1]} />
        <bufferAttribute attach="attributes-aPulseColor" args={[buffers.colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={PULSE_VERT}
        fragmentShader={PULSE_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
