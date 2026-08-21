import { useEffect, useRef, useState } from "react"
import { Link2 } from "lucide-react"
import { copyText } from "@/lib/clipboard"
import { PROTOCOL_SHORT, SCAN_LABEL } from "@/lib/profileLabels"
import { useConnectionStore } from "@/state/connectionStore"
import { useElapsed } from "@/state/useConnectionProgress"

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[rgba(11,11,13,0.55)] px-3 py-2.5">
      <div className="text-[9px] tracking-[0.12em] text-faint uppercase">
        {label}
      </div>
      <div className="mt-[3px] truncate font-mono text-[15px]">{value}</div>
    </div>
  )
}

/**
 * What the connected state shows is the thing the backend actually proved: a
 * SOCKS5 port that accepted a listener, the profile that got there, and how
 * long it has held. Per the design's "proof, not wording" note the address is
 * front and centre and copyable, because it is what the user pastes into
 * whatever client they actually care about.
 */
export function ConnectedPanel({
  socksAddr,
  since,
}: {
  socksAddr: string
  since: number
}) {
  const protocol = useConnectionStore((s) => s.profile.protocol)
  const scanMode = useConnectionStore((s) => s.profile.scan_mode)
  const { formatted } = useElapsed(since)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const copy = async () => {
    if (!(await copyText(socksAddr))) return
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="anim-rise mt-[18px] flex w-full flex-col gap-2.5">
      {/* gap-px over a divider-colored ground draws the cell separators as
       * hairlines without a border on each cell fighting the rounded corners. */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md bg-border">
        <Stat label="Uptime" value={formatted || "0:00"} />
        <Stat label="Protocol" value={PROTOCOL_SHORT[protocol]} />
        <Stat label="Routing" value={SCAN_LABEL[scanMode]} />
      </div>

      <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5">
        <Link2 size={14} strokeWidth={1.4} className="shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] tracking-[0.12em] text-faint uppercase">
            SOCKS5 proxy — point clients here
          </div>
          <div className="mt-0.5 truncate font-mono text-xs">{socksAddr}</div>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-md border border-border px-2.5 py-1 text-[11px] transition-colors hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  )
}
