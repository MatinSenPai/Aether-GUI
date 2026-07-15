import { motion, useReducedMotion } from "motion/react";

/**
 * Two static-blur gradient orbs, only transform/opacity animated (cheap,
 * compositor-only) — never the blur itself, which is expensive to recompute
 * per frame. Mounted once at the App root so it never restarts across
 * MainScreen/SidecarErrorScreen transitions.
 */
export function AmbientBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <motion.div
        className="absolute size-65 rounded-full blur-[65px]"
        style={{
          top: -60,
          right: -60,
          background:
            "radial-gradient(circle, var(--color-primary) 0%, transparent 70%)",
        }}
        animate={
          reduceMotion
            ? { opacity: 0.18 }
            : { x: [0, 20, 0], y: [0, -15, 0], opacity: [0.14, 0.22, 0.14] }
        }
        transition={{ duration: 10, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      />
      <motion.div
        className="absolute size-55 rounded-full blur-[65px]"
        style={{
          bottom: -40,
          left: -80,
          background:
            "radial-gradient(circle, var(--color-status-connected) 0%, transparent 70%)",
        }}
        animate={
          reduceMotion
            ? { opacity: 0.13 }
            : { x: [0, -25, 0], y: [0, 18, 0], opacity: [0.1, 0.16, 0.1] }
        }
        transition={{ duration: 13, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      />
    </div>
  );
}
