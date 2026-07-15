import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";

const appWindow = getCurrentWindow();

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      setIsMaximized(await appWindow.isMaximized());
    };
    void checkMaximized();

    const listenPromise = appWindow.onResized(() => {
      void checkMaximized();
    });

    return () => {
      void listenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={() => void appWindow.toggleMaximize()}
      className="relative z-10 flex h-9 shrink-0 items-center justify-between pl-4 select-none border-b border-white/5 cursor-default"
    >
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground tracking-wider uppercase"
      >
        <span data-tauri-drag-region>Aether</span>
      </div>
      <div className="flex h-full items-center">
        {/* Minimize Button */}
        <button
          aria-label="Minimize"
          className="grid h-full w-13 place-items-center text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          onClick={() => void appWindow.minimize()}
        >
          <Minus className="size-4" />
        </button>

        {/* Maximize/Restore Button */}
        <button
          aria-label={isMaximized ? "Restore" : "Maximize"}
          className="grid h-full w-13 place-items-center text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          onClick={() => void appWindow.toggleMaximize()}
        >
          {isMaximized ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </button>

        {/* Close Button */}
        <button
          aria-label="Close"
          className="grid h-full w-13 place-items-center text-muted-foreground hover:bg-destructive hover:text-white"
          onClick={() => void appWindow.close()}
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
