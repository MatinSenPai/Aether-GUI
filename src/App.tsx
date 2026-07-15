import { useEffect } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ConnectButton } from "@/components/ConnectButton";
import { ConnectionStatusLine } from "@/components/ConnectionStatusLine";
import { AdvancedPanel } from "@/components/AdvancedPanel";
import { AmbientBackground } from "@/components/AmbientBackground";
import { SidecarErrorScreen } from "@/components/SidecarErrorScreen";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initConnectionListeners, useConnectionStore } from "@/state/connectionStore";

const SCREEN_TRANSITION = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const },
};

function MainScreen() {
  return (
    <div className="relative z-10 flex h-svh flex-col items-center p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <ConnectButton />
        <ConnectionStatusLine />
      </div>
      <AdvancedPanel />
    </div>
  );
}

export function App() {
  const sidecarError = useConnectionStore((s) => s.sidecarError);
  const retryAfterSidecarError = useConnectionStore((s) => s.retryAfterSidecarError);
  const connect = useConnectionStore((s) => s.connect);

  useEffect(() => {
    const cleanup = initConnectionListeners();
    return () => {
      void cleanup.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <TooltipProvider>
      <MotionConfig reducedMotion="user">
        <div className="relative h-svh w-full overflow-hidden bg-background">
          <AmbientBackground />
          <AnimatePresence mode="wait">
            {sidecarError ? (
              <motion.div key="error" className="relative z-10" {...SCREEN_TRANSITION}>
                <SidecarErrorScreen
                  message={sidecarError}
                  onRetry={() => {
                    retryAfterSidecarError();
                    void connect();
                  }}
                />
              </motion.div>
            ) : (
              <motion.div key="main" {...SCREEN_TRANSITION}>
                <MainScreen />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </TooltipProvider>
  );
}

export default App;
