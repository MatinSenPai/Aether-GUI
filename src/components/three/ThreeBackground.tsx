import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { MoodDriver } from "./mood";
import { BackgroundGradient } from "./BackgroundGradient";
import { ParticleField } from "./ParticleField";
import { EnergyRing } from "./EnergyRing";

/**
 * The WebGL backdrop. Default-exported so Backdrop can React.lazy it, keeping
 * three out of the initial paint. Pauses its render loop when the window is
 * hidden (battery), and reports context loss up to Backdrop, which then
 * permanently falls back to the CSS orbs.
 */

export default function ThreeBackground({ onContextLost }: { onContextLost: () => void }) {
  const [hidden, setHidden] = useState(() => document.hidden);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      style={{ opacity: ready ? 1 : 0, transition: "opacity 600ms ease-out" }}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop={hidden ? "never" : "always"}
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: "low-power",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0d0d0f", 1);
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
              onContextLost();
            },
            { once: true },
          );
          setReady(true);
        }}
      >
        <MoodDriver />
        <BackgroundGradient />
        <ParticleField />
        <EnergyRing />
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            intensity={0.7}
            luminanceThreshold={1.0}
            luminanceSmoothing={0.25}
            radius={0.6}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
