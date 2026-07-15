import { lazy, Suspense, useEffect, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";

const ThreeBackground = lazy(() => import("./ThreeBackground"));

/**
 * Decides between the WebGL scene and the CSS-orb fallback. Falls back when:
 *  - the user prefers reduced motion (CSS orbs freeze themselves),
 *  - WebGL2 isn't available (covers flaky webkit2gtk on Linux), or
 *  - the WebGL context is lost at runtime.
 * The 3D scene is React.lazy'd, so its chunk loads asynchronously with the
 * CSS orbs shown as the Suspense fallback meanwhile — the window never
 * white-flashes, and the canvas fades in over the orbs once ready.
 */

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export function Backdrop() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [webglOk] = useState(hasWebGL2);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!webglOk || reduced || contextLost) {
    return <AmbientBackground />;
  }

  return (
    <Suspense fallback={<AmbientBackground />}>
      <ThreeBackground onContextLost={() => setContextLost(true)} />
    </Suspense>
  );
}
