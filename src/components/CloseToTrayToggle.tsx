import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Switch } from "@/components/ui/switch";

export function CloseToTrayToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    invoke<boolean>("get_close_to_tray").then((v) => {
      setEnabled(v);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;

  return (
    <div className="flex w-full max-w-sm items-center justify-between px-1 py-2">
      <span className="text-xs text-muted-foreground">
        Minimize to system tray
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={(on) => {
          setEnabled(on);
          void invoke("set_close_to_tray", { enabled: on });
        }}
        aria-label="Minimize to system tray instead of closing"
      />
    </div>
  );
}
