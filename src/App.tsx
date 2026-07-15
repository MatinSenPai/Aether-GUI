import { useEffect } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { ConnectionStatusLine } from "@/components/ConnectionStatusLine";
import { AdvancedPanel } from "@/components/AdvancedPanel";
import { Backdrop } from "@/components/three/Backdrop";
import { SidecarErrorScreen } from "@/components/SidecarErrorScreen";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initConnectionListeners, useConnectionStore } from "@/state/connectionStore";

function MainScreen() {
  return (
    <div className="relative z-10 flex h-full w-full flex-col sm:flex-row items-center sm:items-stretch sm:justify-center gap-8 p-6 max-w-4xl mx-auto overflow-y-auto scrollbar-none">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:w-1/2">
        <ConnectButton />
        <ConnectionStatusLine />
      </div>
      <div className="hidden sm:block w-px bg-border/20 self-stretch my-6" />
      <div className="w-full max-w-sm sm:max-w-md sm:flex-1 sm:flex sm:flex-col sm:justify-center sm:w-1/2 sm:min-h-0">
        <AdvancedPanel />
      </div>
    </div>
  );
}

/**
 * App root — font loading handled by index.css, no JS animation libraries.
 * Screen transitions (error <-> main) use CSS opacity/transform transitions
 * triggered by a data attribute on the container, keeping the runtime cost
 * at zero when not animating.
 */
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
      <div className="relative flex h-svh w-full flex-col overflow-hidden bg-background">
        <Backdrop />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className="screen-transition"
            data-visible={!sidecarError}
          >
            <div className="absolute inset-0">
              <MainScreen />
            </div>
          </div>
          <div
            className="screen-transition"
            data-visible={!!sidecarError}
          >
            <div className="absolute inset-0 z-10">
              <SidecarErrorScreen
                message={sidecarError ?? ""}
                onRetry={() => {
                  retryAfterSidecarError();
                  void connect();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default App;
