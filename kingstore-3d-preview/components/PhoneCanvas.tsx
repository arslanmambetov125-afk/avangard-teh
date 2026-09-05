"use client";

import type { MutableRefObject } from "react";
import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

interface PhoneCanvasProps {
  progress: MutableRefObject<number>;
  active: boolean;
  staticMode: boolean;
}

function clamp01(value: number) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smooth(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function phase(value: number, start: number, end: number) {
  return smooth((value - start) / (end - start));
}

function pulse(value: number, start: number, peak: number, end: number) {
  return value <= peak ? phase(value, start, peak) : 1 - phase(value, peak, end);
}

function dampPosition(
  object: THREE.Object3D | null,
  target: readonly [number, number, number],
  delta: number,
) {
  if (!object) return;
  object.position.x = THREE.MathUtils.damp(object.position.x, target[0], 6, delta);
  object.position.y = THREE.MathUtils.damp(object.position.y, target[1], 6, delta);
  object.position.z = THREE.MathUtils.damp(object.position.z, target[2], 6, delta);
}

function Phone({ progress, staticMode }: Pick<PhoneCanvasProps, "progress" | "staticMode">) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const screen = useRef<THREE.Group>(null);
  const camera = useRef<THREE.Group>(null);
  const chip = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const p = staticMode ? 0.52 : clamp01(progress.current);
    const explode = pulse(p, 0.12, 0.52, 0.84);
    const finale = phase(p, 0.78, 1);
    const pointerX = staticMode ? 0 : state.pointer.x;
    const pointerY = staticMode ? 0 : state.pointer.y;

    if (root.current) {
      root.current.rotation.x = THREE.MathUtils.damp(
        root.current.rotation.x,
        THREE.MathUtils.lerp(0.14, -0.08, p) - pointerY * 0.045,
        5,
        delta,
      );
      root.current.rotation.y = THREE.MathUtils.damp(
        root.current.rotation.y,
        THREE.MathUtils.lerp(-0.48, 0.42, p) + pointerX * 0.09,
        5,
        delta,
      );
      root.current.rotation.z = THREE.MathUtils.damp(
        root.current.rotation.z,
        THREE.MathUtils.lerp(-0.07, 0.035, finale),
        5,
        delta,
      );
      const scale = THREE.MathUtils.lerp(0.94, 1.04, phase(p, 0, 0.28));
      root.current.scale.setScalar(THREE.MathUtils.damp(root.current.scale.x, scale, 5, delta));
    }

    dampPosition(body.current, [-0.52 * explode, 0, -0.08 * explode], delta);
    dampPosition(screen.current, [1.34 * explode, 0.04 * explode, 0.45 * explode], delta);
    dampPosition(camera.current, [-1.18 * explode, 0.78 * explode, 0.72 * explode], delta);
    dampPosition(chip.current, [0.7 * explode, -1.26 * explode, 0.55 * explode], delta);

    if (halo.current) {
      halo.current.rotation.z += delta * (0.12 + p * 0.2);
      const material = halo.current.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.damp(material.opacity, 0.14 + explode * 0.3, 5, delta);
    }
  });

  return (
    <group ref={root} scale={0.94}>
      <mesh ref={halo} position={[0, 0, -1.2]}>
        <torusGeometry args={[3.12, 0.012, 8, 128]} />
        <meshBasicMaterial color="#f4c900" transparent opacity={0.18} />
      </mesh>

      <group ref={body}>
        <RoundedBox args={[2.3, 4.72, 0.34]} radius={0.24} smoothness={8}>
          <meshStandardMaterial color="#1b1b1b" metalness={0.9} roughness={0.2} />
        </RoundedBox>
        <RoundedBox position={[0, 0, -0.2]} args={[2.16, 4.55, 0.08]} radius={0.21} smoothness={8}>
          <meshStandardMaterial color="#080808" metalness={0.55} roughness={0.28} />
        </RoundedBox>
      </group>

      <group ref={screen} position={[0, 0, 0.22]}>
        <RoundedBox args={[2.09, 4.43, 0.075]} radius={0.2} smoothness={8}>
          <meshPhysicalMaterial color="#080a0c" metalness={0.18} roughness={0.05} clearcoat={1} />
        </RoundedBox>
        <mesh position={[0, 0.3, 0.045]}>
          <planeGeometry args={[1.74, 2.95]} />
          <meshBasicMaterial color="#141610" />
        </mesh>
        <mesh position={[0, 0.3, 0.052]}>
          <ringGeometry args={[0.56, 1.05, 96, 1, 0.18, 4.85]} />
          <meshBasicMaterial color="#f4c900" transparent opacity={0.8} />
        </mesh>
        <RoundedBox position={[0, 1.87, 0.055]} args={[0.58, 0.16, 0.035]} radius={0.08} smoothness={6}>
          <meshBasicMaterial color="#020202" />
        </RoundedBox>
      </group>

      <group ref={camera} position={[0, 0, 0.24]}>
        <RoundedBox position={[-0.57, 1.4, 0]} args={[0.93, 1.22, 0.15]} radius={0.18} smoothness={6}>
          <meshStandardMaterial color="#292929" metalness={0.78} roughness={0.23} />
        </RoundedBox>
        {([[-0.78, 1.65], [-0.36, 1.4], [-0.76, 1.15]] as const).map(([x, y], index) => (
          <group key={index} position={[x, y, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.205, 0.205, 0.09, 48]} />
              <meshStandardMaterial color="#050505" metalness={0.82} roughness={0.12} />
            </mesh>
            <mesh position={[0, 0.052, 0]}>
              <cylinderGeometry args={[0.116, 0.116, 0.012, 48]} />
              <meshPhysicalMaterial color="#101a25" metalness={0.72} roughness={0.06} clearcoat={1} />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={chip} position={[0, 0, 0.2]}>
        <RoundedBox args={[0.86, 0.86, 0.11]} radius={0.08} smoothness={5}>
          <meshStandardMaterial color="#151309" metalness={0.5} roughness={0.32} emissive="#6d5800" emissiveIntensity={0.28} />
        </RoundedBox>
        <mesh position={[0, 0, 0.06]}>
          <planeGeometry args={[0.48, 0.48]} />
          <meshBasicMaterial color="#f4c900" />
        </mesh>
      </group>
    </group>
  );
}

function CssFallback() {
  return (
    <div className="css-phone" role="img" aria-label="Смартфон в разобранном виде">
      <i className="css-phone-body" />
      <i className="css-phone-screen" />
      <i className="css-phone-camera" />
      <b>K</b>
    </div>
  );
}

export default function PhoneCanvas({ progress, active, staticMode }: PhoneCanvasProps) {
  const [dpr, setDpr] = useState(1.25);

  return (
    <Canvas
      dpr={dpr}
      frameloop={active || staticMode ? "always" : "demand"}
      camera={{ position: [0, 0, 7.35], fov: 34, near: 0.1, far: 50 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      fallback={<CssFallback />}
    >
      <PerformanceMonitor
        flipflops={3}
        onIncline={() => setDpr(1.5)}
        onDecline={() => setDpr(1)}
        onFallback={() => setDpr(1)}
      />
      <ambientLight intensity={1.4} />
      <directionalLight position={[4, 6, 7]} intensity={4.2} />
      <directionalLight position={[-5, -3, 4]} intensity={1.8} color="#f4c900" />
      <pointLight position={[0, 0, 5]} intensity={6} distance={14} />
      <Suspense fallback={null}>
        <Phone progress={progress} staticMode={staticMode} />
      </Suspense>
    </Canvas>
  );
}
