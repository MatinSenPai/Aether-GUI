import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mood } from "./mood";

/**
 * The centerpiece behind the connect button: two counter-rotating,
 * counter-tilted thin tori (the actual 3D read) plus a soft additive
 * core-glow plane. It tracks the DOM button's on-screen position (via the
 * `data-connect-anchor` element) so it stays aligned when the Advanced panel
 * opens and shifts the layout; damped so it glides rather than snaps. If the
 * anchor is gone (SidecarErrorScreen), it fades out for free.
 *
 * Bloom is selective by HDR value: `toneMapped={false}` + color scaled past
 * 1.0 by `mood.ringBrightness` is exactly what crosses the composer's
 * luminanceThreshold, so no masking layers are needed — Idle (0.6) doesn't
 * glow, Connecting (2.2) glows orange, Connected (1.4) glows soft teal.
 */

const GLOW_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uStrength;
  void main() {
    float d = length(vUv - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.4) * uStrength;
    gl_FragColor = vec4(uColor, a);
  }
`;

const GLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function EnergyRing() {
  const group = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const glowMat = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();

  const glowUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#f2711c") },
      uStrength: { value: 0 },
    }),
    [],
  );

  // Reused scratch objects (no per-frame allocation).
  const targetPos = useRef(new THREE.Vector3());

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const g = group.current;
    if (!g) return;

    // --- Track the DOM button, or fade out if it's gone. ---
    const anchor = document.querySelector<HTMLElement>("[data-connect-anchor]");
    let anchorPresent = false;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      if (rect.width > 0) {
        anchorPresent = true;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const wx = (cx / size.width) * 2 - 1;
        const wy = -((cy / size.height) * 2 - 1);
        targetPos.current.set((wx * viewport.width) / 2, (wy * viewport.height) / 2, 0);
      }
    }
    if (anchorPresent) {
      g.position.x = THREE.MathUtils.damp(g.position.x, targetPos.current.x, 8, delta);
      g.position.y = THREE.MathUtils.damp(g.position.y, targetPos.current.y, 8, delta);
    }

    // Presence multiplier: kills all glow/opacity when the button is absent.
    const presence = anchorPresent ? 1 : 0;
    const opacityMul = THREE.MathUtils.damp(
      (g.userData.presence as number) ?? 1,
      presence,
      6,
      delta,
    );
    g.userData.presence = opacityMul;

    // --- Rotation (counter-spinning) + error shake. ---
    const shake = (Math.random() - 0.5) * mood.jitter * 0.2;
    if (ringA.current) ringA.current.rotation.z += delta * mood.ringSpeed + shake;
    if (ringB.current) ringB.current.rotation.z -= delta * mood.ringSpeed * 0.7 + shake;

    // --- Connected burst envelope (scale + brightness flash). ---
    const burstScale = 1 + mood.burst * 0.55;
    const burstBright = 1 + mood.burst * 1.6;
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, burstScale, 10, delta));

    // --- Materials: color * brightness (HDR -> selective bloom), opacity. ---
    const bright = mood.ringBrightness * burstBright;
    const applyRing = (mesh: THREE.Mesh | null, opacityScale: number) => {
      if (!mesh) return;
      const m = mesh.material as THREE.MeshBasicMaterial;
      m.color.copy(mood.ringColor).multiplyScalar(bright);
      m.opacity = mood.ringOpacity * opacityScale * opacityMul;
    };
    applyRing(ringA.current, 1);
    applyRing(ringB.current, 0.5);

    if (glowMat.current) {
      glowMat.current.uniforms.uColor.value.copy(mood.ringColor);
      glowMat.current.uniforms.uStrength.value =
        (mood.glowStrength + mood.burst * 0.35) * opacityMul;
    }
  });

  return (
    <group ref={group}>
      <mesh ref={ringA} rotation={[1.15, 0, 0]}>
        <torusGeometry args={[1.5, 0.018, 8, 128]} />
        <meshBasicMaterial
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringB} rotation={[1.35, 0, 0]}>
        <torusGeometry args={[1.72, 0.01, 8, 128]} />
        <meshBasicMaterial
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <planeGeometry args={[4.5, 4.5]} />
        <shaderMaterial
          ref={glowMat}
          vertexShader={GLOW_VERT}
          fragmentShader={GLOW_FRAG}
          uniforms={glowUniforms}
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
