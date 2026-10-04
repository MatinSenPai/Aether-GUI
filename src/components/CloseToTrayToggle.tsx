import { BackendToggle } from "@/components/BackendToggle";

export function CloseToTrayToggle() {
  return (
    <BackendToggle
      label="Minimize to system tray"
      getCommand="get_close_to_tray"
      setCommand="set_close_to_tray"
    />
  );
}
