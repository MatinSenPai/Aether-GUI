import { useEffect } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ConnectButton } from "@/components/ConnectButton";
import { ConnectionStatusLine } from "@/components/ConnectionStatusLine";
import { SystemProxyToggle } from "@/components/SystemProxyToggle";
import { AdvancedPanel } from "@/components/AdvancedPanel";
import { ExpertPanel } from "@/components/ExpertPanel";
import { AmbientBackground } from "@/components/AmbientBackground";
import { SidecarErrorScreen } from "@/components/SidecarErrorScreen";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TitleBar } from "@/components/TitleBar";
import { initConnectionListeners, useConnectionStore } from "@/state/connectionStore";

const SCREEN_TRANSITION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const },
};

function MainScreen() {
  return (
    <div className="relative z-10 flex h-full flex-col overflow-y-auto">
      {/* justify-[safe_center] instead of justify-center: centers the group
       * while it fits the viewport (the common, Advanced-collapsed case),
       * but falls back to start-alignment the moment content overflows
       * (Advanced expanded) instead of centering into it. Plain `center`
       * centers symmetrically even when overflowing, pushing the top half
       * above scrollTop=0 — unreachable, since scroll can't go negative —
       * which is exactly what was clipping the Connect button. `safe`
       * removes that failure mode entirely rather than working around it. */}
      <div className="flex min-h-full w-full flex-col items-center justify-[safe_center] gap-5 px-6 py-5">
        <div className="flex flex-col items-center gap-5">
          <ConnectButton />
          <ConnectionStatusLine />
          <SystemProxyToggle />
        </div>
        <AdvancedPanel />
        <ExpertPanel />
      </div>
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
        <div className="relative flex h-svh w-full flex-col overflow-hidden bg-background">
          <AmbientBackground />
          <TitleBar />
          <div className="relative min-h-0 flex-1">
            <AnimatePresence mode="sync">
              {sidecarError ? (
                <motion.div key="error" className="absolute inset-0 z-10" {...SCREEN_TRANSITION}>
                  <SidecarErrorScreen
                    message={sidecarError}
                    onRetry={() => {
                      retryAfterSidecarError();
                      void connect();
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div key="main" className="absolute inset-0" {...SCREEN_TRANSITION}>
                  <MainScreen />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </MotionConfig>
    </TooltipProvider>
  );
}

export default App;
