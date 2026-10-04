import { useConnectionStore } from "@/state/connectionStore"

const INPUT =
  "h-8 w-full rounded-md bg-black/20 px-2 text-xs text-foreground ring-1 ring-white/10 outline-none focus:ring-primary disabled:opacity-50"

/** Aether 1.6–2.1 connection extras: HTTP CONNECT listener, upstream proxy
 * chaining and the exit-country filter. All optional; empty means off. */
export function ProxyChainSettings() {
  const profile = useConnectionStore((s) => s.profile)
  const status = useConnectionStore((s) => s.status)
  const setHttpProxy = useConnectionStore((s) => s.setHttpProxy)
  const setUpstream = useConnectionStore((s) => s.setUpstream)
  const setExitLoc = useConnectionStore((s) => s.setExitLoc)
  const locked = status.state !== "Idle" && status.state !== "Error"

  return (
    <div className="flex flex-col gap-2 rounded-md bg-black/10 p-2 ring-1 ring-white/10">
      <input
        type="text"
        value={profile.http_proxy}
        disabled={locked}
        onChange={(e) => setHttpProxy(e.target.value)}
        placeholder="HTTP proxy address, e.g. 127.0.0.1:1822 (optional)"
        className={INPUT}
        aria-label="HTTP CONNECT proxy address"
      />
      <input
        type="text"
        value={profile.upstream}
        disabled={locked}
        onChange={(e) => setUpstream(e.target.value)}
        placeholder="Upstream proxy, e.g. socks5://127.0.0.1:1080 (optional)"
        className={INPUT}
        aria-label="Upstream proxy URL"
      />
      <input
        type="text"
        value={profile.exit_loc}
        disabled={locked}
        onChange={(e) => setExitLoc(e.target.value)}
        placeholder="Exit countries, e.g. !IR,RU or DE,SE (optional)"
        className={INPUT}
        aria-label="Allowed or blocked exit countries"
      />
      <p className="text-[10px] leading-4 text-muted-foreground">
        Upstream accepts <code>socks5://</code>, <code>http://</code> or bare{" "}
        <code>host:port</code>; an HTTP upstream needs MASQUE over HTTP/2. A
        leading <code>!</code> in exit countries blocks them instead of
        allowing only them.
      </p>
    </div>
  )
}
