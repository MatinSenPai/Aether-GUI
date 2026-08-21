import { Settings2, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePanelStore, type PanelTab } from "@/state/panelStore"

function FooterButton({
  tab,
  label,
  icon: Icon,
}: {
  tab: PanelTab
  label: string
  icon: typeof Terminal
}) {
  const panel = usePanelStore((s) => s.panel)
  const toggle = usePanelStore((s) => s.toggle)
  const active = panel === tab
  return (
    <button
      type="button"
      onClick={() => toggle(tab)}
      aria-expanded={active}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        active
          ? "bg-primary/12 text-primary"
          : "text-primary hover:bg-primary/10"
      )}
    >
      <Icon size={13} strokeWidth={1.4} />
      {label}
    </button>
  )
}

/** Version on the left, the two drawers on the right. Both buttons toggle,
 * so the same click that opened the drawer closes it. */
export function StatusBar() {
  return (
    <footer className="relative z-10 flex shrink-0 items-center gap-1 px-4 pt-3 pb-3.5">
      <span className="text-[10.5px] text-foreground/40">
        Aether-GUI {__APP_VERSION__}
      </span>
      <div className="ml-auto flex items-center gap-0.5">
        <FooterButton tab="logs" label="Logs" icon={Terminal} />
        <FooterButton tab="settings" label="Settings" icon={Settings2} />
      </div>
    </footer>
  )
}
