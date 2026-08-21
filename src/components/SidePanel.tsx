import { useEffect } from "react"
import { X } from "lucide-react"
import { LogsPanel } from "@/components/LogsPanel"
import { SettingsPanel } from "@/components/settings/SettingsPanel"
import { cn } from "@/lib/utils"
import { usePanelStore, PANEL_WIDTH, type PanelTab } from "@/state/panelStore"

const TABS: { id: PanelTab; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "logs", label: "Logs" },
]

/**
 * The drawer. It does not overlay the app column — the host window grows
 * sideways to reveal it (see panelStore), so the dial never moves and the
 * panel reads as a second surface rather than a modal covering the first.
 */
export function SidePanel() {
  const panel = usePanelStore((s) => s.panel)
  const open = usePanelStore((s) => s.open)
  const close = usePanelStore((s) => s.close)

  useEffect(() => {
    if (!panel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [panel, close])

  if (!panel) return null

  return (
    <aside
      className="flex shrink-0 flex-col border-l border-border bg-[rgba(233,233,237,0.035)]"
      style={{ width: PANEL_WIDTH }}
    >
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border py-3 pr-3 pl-[18px]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => open(t.id)}
            aria-current={panel === t.id}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12.5px] transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              panel === t.id
                ? "bg-white/6 text-foreground"
                : "text-[var(--neutral-500)] hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={close}
          aria-label="Close panel"
          className="ml-auto grid size-[26px] place-items-center rounded-md text-faint transition-colors hover:bg-white/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <X className="size-3" strokeWidth={1.4} />
        </button>
      </div>

      {panel === "settings" ? <SettingsPanel /> : <LogsPanel />}
    </aside>
  )
}
