/**
 * MatchUserNode — Warm gold node rendered at the citizen's match-derived
 * alignment position on the globe during the spatial match reveal.
 *
 * Bloom-integrated via toneMapped={false}, billboards to camera, and
 * animates in with a scale-up + gentle pulse.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const USER_NODE_COLOR = new THREE.Color('#f0e6d0'); // USER_COLOR — warm white-gold
const CIRCLE_GEO = new THREE.CircleGeometry(0.15, 32);
const SPRING_SPEED = 4; // scale-up spring speed
const PULSE_SPEED = 2; // gentle breathing pulse
const PULSE_AMPLITUDE = 0.05;

interface MatchUserNodeProps {
  position: [number, number, number];
  intensity: number;
}

export function MatchUserNode({ position, intensity }: MatchUserNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const scaleRef = useRef(0); // starts at 0, springs up

  const targetScale = 0.8 + intensity * 0.4;

  useFrame(({ camera, clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Billboard: face the camera
    mesh.quaternion.copy(camera.quaternion);

    // Scale-up animation (spring-like ease-out)
    const dt = Math.min(clock.getDelta(), 0.05); // clamp for tab-switch
    scaleRef.current += (targetScale - scaleRef.current) * SPRING_SPEED * dt;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * PULSE_SPEED) * PULSE_AMPLITUDE;
    const s = scaleRef.current * pulse;
    mesh.scale.set(s, s, s);
  });

  return (
    <mesh ref={meshRef} position={position} geometry={CIRCLE_GEO}>
      <meshBasicMaterial
        color={USER_NODE_COLOR}
        transparent
        opacity={0.9}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
