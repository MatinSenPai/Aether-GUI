import { ChevronRight } from "lucide-react"
import {
  MASQUE_NOIZE_LABEL,
  PROTOCOL_SHORT,
  SCAN_LABEL,
  WG_NOIZE_LABEL,
  usesMasque,
} from "@/lib/profileLabels"
import { useConnectionStore } from "@/state/connectionStore"
import { usePanelStore } from "@/state/panelStore"

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded-[6px] bg-surface-4 px-2 py-[3px] text-[10px] leading-none text-foreground/90">
      {children}
    </span>
  )
}

/**
 * The whole profile as three tags and a chevron. It is the only route into
 * the settings drawer from the main column, which is the point: the design
 * puts one control on screen and keeps every knob one deliberate click away.
 */
export function ProfileSummary() {
  const profile = useConnectionStore((s) => s.profile)
  const open = usePanelStore((s) => s.open)

  const masque = usesMasque(profile.protocol)
  const tags = [
    PROTOCOL_SHORT[profile.protocol],
    masque ? (profile.masque_http2 ? "HTTP/2" : "HTTP/3") : null,
    masque
      ? MASQUE_NOIZE_LABEL[profile.masque_noize]
      : WG_NOIZE_LABEL[profile.wg_noize],
    SCAN_LABEL[profile.scan_mode],
  ].filter((t): t is string => t !== null)

  return (
    <button
      type="button"
      onClick={() => open("settings")}
      aria-label="Open connection settings"
      className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    >
      <span className="text-[9px] tracking-[0.12em] text-faint uppercase">
        Profile
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        {tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
        <ChevronRight size={12} strokeWidth={1.5} className="text-primary" />
      </span>
    </button>
  )
}
