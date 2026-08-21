import {
  PANEL_INPUT,
  PANEL_TEXTAREA,
} from "@/components/settings/SettingsPrimitives"
import { isLocked } from "@/lib/connectionView"
import { useConnectionStore } from "@/state/connectionStore"

/** Aether 1.5.0 DNS and routing controls. Each list accepts the exact
 * comma/newline-separated format documented by the core. */
export function RoutingSettings() {
  const profile = useConnectionStore((s) => s.profile)
  const status = useConnectionStore((s) => s.status)
  const setDns = useConnectionStore((s) => s.setDns)
  const setRouteBlock = useConnectionStore((s) => s.setRouteBlock)
  const setRouteDirect = useConnectionStore((s) => s.setRouteDirect)
  const setRoutesFile = useConnectionStore((s) => s.setRoutesFile)
  const locked = isLocked(status)

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={profile.dns}
        disabled={locked}
        onChange={(e) => setDns(e.target.value)}
        placeholder="Tunnel DNS, e.g. 1.1.1.1,1.0.0.1 (optional)"
        className={PANEL_INPUT}
        aria-label="Tunnel DNS resolvers"
      />
      <textarea
        value={profile.route_block}
        disabled={locked}
        onChange={(e) => setRouteBlock(e.target.value)}
        placeholder="Block: domains, CIDRs, ports… (optional)"
        className={PANEL_TEXTAREA}
        aria-label="Blocked routes"
      />
      <textarea
        value={profile.route_direct}
        disabled={locked}
        onChange={(e) => setRouteDirect(e.target.value)}
        placeholder="Direct: banking, LAN, domestic sites… (optional)"
        className={PANEL_TEXTAREA}
        aria-label="Direct routes"
      />
      <input
        type="text"
        value={profile.routes_file}
        disabled={locked}
        onChange={(e) => setRoutesFile(e.target.value)}
        placeholder="Rules file path (optional)"
        className={PANEL_INPUT}
        aria-label="Routing rules file path"
      />
      <p className="text-[11px] leading-normal text-faint">
        Supports domain, IP/CIDR, <code className="font-mono">port:443</code>,{" "}
        <code className="font-mono">private</code>, and Aether&apos;s{" "}
        <code className="font-mono">full:</code>/
        <code className="font-mono">keyword:</code>/
        <code className="font-mono">regexp:</code> rules. Block wins over
        direct.
      </p>
    </div>
  )
}
