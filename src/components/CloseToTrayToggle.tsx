import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Switch } from "@/components/ui/switch"
import { Section, ToggleRow } from "@/components/settings/SettingsPrimitives"

/** The one setting on the panel that is not part of the connection profile,
 * so it is not locked mid-session — closing behaviour is a window
 * preference, not something Aether reads at launch. */
export function CloseToTrayToggle() {
  const [enabled, setEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    invoke<boolean>("get_close_to_tray")
      .then((v) => {
        setEnabled(v)
        setLoaded(true)
      })
      // Outside Tauri (plain-browser dev) there is no window to keep alive,
      // so the row stays hidden rather than showing a control that lies.
      .catch(() => setLoaded(false))
  }, [])

  if (!loaded) return null

  return (
    <Section title="Application">
      <ToggleRow
        title="Close to tray"
        description="Closing the window keeps the tunnel running in the system tray."
      >
        <Switch
          checked={enabled}
          onCheckedChange={(on) => {
            setEnabled(on)
            void invoke("set_close_to_tray", { enabled: on })
          }}
          aria-label="Close to system tray instead of quitting"
        />
      </ToggleRow>
    </Section>
  )
}
