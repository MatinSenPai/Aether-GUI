import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Switch } from "@/components/ui/switch";

/** A switch backed by a pair of Tauri commands (`get_x` / `set_x`) for
 * app-level preferences that live outside the connection profile. */
export function BackendToggle({
  label,
  getCommand,
  setCommand,
}: {
  label: string;
  getCommand: string;
  setCommand: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    invoke<boolean>(getCommand)
      .then((v) => setEnabled(v))
      .finally(() => setLoaded(true));
  }, [getCommand]);

  if (!loaded) return null;

  return (
    <div className="flex w-full max-w-sm items-center justify-between px-1 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Switch
        checked={enabled}
        onCheckedChange={(on) => {
          setEnabled(on);
          // Roll back if the OS refuses (e.g. autostart registration).
          invoke(setCommand, { enabled: on }).catch(() => setEnabled(!on));
        }}
        aria-label={label}
      />
    </div>
  );
}
