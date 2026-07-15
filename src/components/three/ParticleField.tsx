import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mood, themeColors } from "./mood";

/**
 * A single THREE.Points (one draw call, 1800 particles). ALL motion happens
 * in the vertex shader — the CPU only pushes uniforms per frame, never
 * re-uploads attributes. Cylindrical distribution around the scene center so
 * the connecting-state vortex is one line (inner particles orbit faster).
 * ~15% of particles are teal-flagged and only surface as `tealMix` rises, so
 * teal literally emerges when the tunnel connects.
 */

const COUNT = 850;

/** Builds the static per-particle attributes once. A deterministic PRNG keeps
 * the field stable across reloads/HMR (purely cosmetic — avoids the field
 * reshuffling every hot update). Kept at module scope so the mutable PRNG
 * state never lives inside a render/useMemo body. */
function buildGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const seed = new Float32Array(COUNT * 4);
  const meta = new Float32Array(COUNT * 2);
  let s = 1337;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < COUNT; i++) {
    const r = 0.7 + 4.3 * Math.sqrt(rand());
    seed[i * 4 + 0] = r;
    seed[i * 4 + 1] = rand() * Math.PI * 2;
    seed[i * 4 + 2] = (rand() - 0.5) * 9.6;
    seed[i * 4 + 3] = rand();
    meta[i * 2 + 0] = -5.0 + rand() * 6.5; // z
    meta[i * 2 + 1] = rand() < 0.15 ? 1 : 0; // teal flag
  }
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  geo.setAttribute("aMeta", new THREE.BufferAttribute(meta, 2));
  // three requires a position attribute even though the vertex shader
  // computes its own — a zero-filled placeholder satisfies it.
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  return geo;
}

const VERT = /* glsl */ `
  precision highp float;
  attribute vec4 aSeed;    // r, theta0, y0, k
  attribute vec2 aMeta;    // z, colorFlag
  uniform float uSwirlTime;
  uniform float uContract;
  uniform float uExpand;
  uniform float uJitter;
  varying float vAlpha;
  varying float vFlag;
  varying float vK;

  void main() {
    float r = aSeed.x;
    float theta0 = aSeed.y;
    float y0 = aSeed.z;
    float k = aSeed.w;

    float rEff = r * mix(1.0, 0.6, uContract) * mix(1.0, 1.18, uExpand);
    float theta = theta0 + uSwirlTime * (1.2 / r);

    vec3 pos = vec3(
      cos(theta) * rEff,
      y0 + sin(uSwirlTime * 3.0 + k * 6.28) * 0.18,
      aMeta.x + sin(theta) * rEff * 0.15
    );

    // Error scatter impulse.
    pos += (fract(vec3(k * 7.1, k * 13.3, k * 3.7)) - 0.5) * uJitter * 0.6;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp((1.5 + 2.0 * k) * (300.0 / -mvPosition.z), 1.0, 8.0);

    vAlpha = 0.06 + 0.16 * k;
    vFlag = aMeta.y;
    vK = k;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uWarmDim;
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform float uTealMix;
  uniform float uEnergy;
  varying float vAlpha;
  varying float vFlag;
  varying float vK;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha * uEnergy;
    if (a <= 0.001) discard;

    vec3 warm = mix(uWarmDim, uWarm, vK * 0.55);
    vec3 col = (vFlag > 0.5) ? mix(warm, uCool, uTealMix) : warm;

    gl_FragColor = vec4(col, a);
  }
`;

export function ParticleField() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => buildGeometry(), []);

  const uniforms = useMemo(() => {
    const theme = themeColors();
    return {
      uSwirlTime: { value: 0 },
      uContract: { value: 0 },
      uExpand: { value: 0 },
      uJitter: { value: 0 },
      uTealMix: { value: 0 },
      uEnergy: { value: mood.energy },
      uWarmDim: { value: new THREE.Color("#6b6b6b") },
      uWarm: { value: theme.warm.clone() },
      uCool: { value: theme.cool.clone() },
    };
  }, []);

  useFrame(() => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    u.uSwirlTime.value = mood.swirlTime;
    u.uContract.value = mood.contract;
    u.uExpand.value = mood.expand + mood.burst * 0.4; // burst overshoot on Connected
    u.uJitter.value = mood.jitter;
    u.uTealMix.value = mood.tealMix;
    u.uEnergy.value = mood.energy;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
