import { AmbientBackground } from "@/components/AmbientBackground";

/**
 * Pure CSS backdrop — the Three.js WebGL scene has been removed to minimise
 * resource consumption (GPU, CPU, memory). Two static-blur gradient orbs with
 * only transform/opacity animated (compositor-only) replace what was a full
 * 3D render loop with shader programs, particle attributes, and per-frame
 * uniform uploads.
 */
export function Backdrop() {
  return <AmbientBackground />;
}
