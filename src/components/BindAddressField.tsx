import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { PANEL_INPUT } from "@/components/settings/SettingsPrimitives"
import { isLocked } from "@/lib/connectionView"
import { useConnectionStore } from "@/state/connectionStore"

const DEFAULT_PORT = "1819"
const LOOPBACK = "127.0.0.1"
const ANY = "0.0.0.0"

function splitAddr(addr: string): { host: string; port: string } {
  const last = addr.lastIndexOf(":")
  if (last === -1) return { host: LOOPBACK, port: addr || DEFAULT_PORT }
  return {
    host: addr.slice(0, last) || LOOPBACK,
    port: addr.slice(last + 1) || DEFAULT_PORT,
  }
}

export function BindAddressField() {
  const bind = useConnectionStore((s) => s.profile.bind_address)
  const setBindAddress = useConnectionStore((s) => s.setBindAddress)
  const status = useConnectionStore((s) => s.status)
  const locked = isLocked(status)

  const { host, port } = splitAddr(bind)
  const lan = host === ANY

  const rebuild = (h: string, p: string) =>
    setBindAddress(`${h}:${p || DEFAULT_PORT}`)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-xs text-muted-foreground">{host}</span>
        <span className="font-mono text-xs text-faint">:</span>
        <input
          type="text"
          inputMode="numeric"
          value={port}
          disabled={locked}
          onChange={(e) =>
            rebuild(host, e.target.value.replace(/\D/g, "").slice(0, 5))
          }
          onBlur={() => {
            const n = Number(port)
            if (!port || n < 1 || n > 65535) rebuild(host, DEFAULT_PORT)
          }}
          className={cn(PANEL_INPUT, "w-20 text-center font-mono")}
          aria-label="SOCKS5 port"
        />
      </div>
      <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
        <p className="text-xs leading-snug text-muted-foreground">
          Allow connections from the LAN — other devices on this network can use
          the tunnel.
        </p>
        <div className="ml-auto shrink-0">
          <Switch
            checked={lan}
            onCheckedChange={(on) => rebuild(on ? ANY : LOOPBACK, port)}
            disabled={locked}
            aria-label="Allow connections from the LAN"
          />
        </div>
      </div>
    </div>
  )
}
