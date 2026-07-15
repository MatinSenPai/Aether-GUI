import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mood, themeColors } from "./mood";

/**
 * Fullscreen flowing-gradient plane. The vertex shader bypasses the camera
 * entirely (writes clip-space directly) so it always covers the viewport with
 * zero projection math. The fragment shader is a hand-written domain-warped
 * fbm (own code — no third-party noise): value noise -> 3-octave fbm -> two
 * IQ-style warp layers, which reads as slow aurora rather than a lava lamp.
 * A hard luminance ceiling keeps it firmly a *background*; a dither term
 * kills the banding that plagues dark gradients on 8-bit displays.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.99999, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uTealMix;
  uniform float uAspect;
  uniform vec3 uBase;
  uniform vec3 uWarm;
  uniform vec3 uCool;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0) * 2.2;

    // Two-layer domain warp — the thing that makes it flow like aurora.
    vec2 q = vec2(fbm(p + uTime * 0.30), fbm(p + vec2(5.2, 1.3) - uTime * 0.22));
    vec2 r = vec2(fbm(p + 1.6 * q + uTime * 0.15), fbm(p + 1.6 * q + vec2(8.3, 2.8)));
    float f = fbm(p + 1.8 * r);

    vec3 col = uBase;

    // Warm mass biased toward top-right (echoes the old orange orb).
    float warmMask = smoothstep(0.38, 0.85, f)
      * (0.55 + 0.45 * smoothstep(0.9, -0.2, distance(uv, vec2(0.85, 0.9))));
    col += uWarm * warmMask * 0.16 * uEnergy;

    // Cool region bottom-left, strengthens as the tunnel connects.
    float coolMask = smoothstep(0.55, 0.95, q.x)
      * smoothstep(0.9, 0.1, distance(uv, vec2(0.12, 0.15)));
    col += uCool * coolMask * (0.05 + 0.13 * uTealMix) * uEnergy;

    // Hard ceiling: always reads as background, never competes with the UI.
    col = min(col, vec3(0.20));

    // Dither to kill 8-bit banding on the near-black gradient.
    col += (hash(uv * 913.0 + fract(uTime)) - 0.5) * 0.012;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function BackgroundGradient() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();

  const uniforms = useMemo(() => {
    const theme = themeColors();
    return {
      uTime: { value: 0 },
      uEnergy: { value: mood.energy },
      uTealMix: { value: mood.tealMix },
      uAspect: { value: size.width / size.height },
      uBase: { value: theme.base.clone() },
      uWarm: { value: theme.warm.clone() },
      uCool: { value: theme.cool.clone() },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; live values pushed per-frame below.
  }, []);

  useFrame(() => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    u.uTime.value = mood.gradientTime;
    u.uEnergy.value = mood.energy;
    u.uTealMix.value = mood.tealMix;
    u.uAspect.value = size.width / size.height;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
