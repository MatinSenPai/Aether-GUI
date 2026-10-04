import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnectionStore } from "@/state/connectionStore";
import type { NetworkMode } from "@/types/connection";

const LABELS: Record<NetworkMode, string> = {
  warp: "WARP (default)",
  psiphon_only: "Psiphon",
  tor_only: "Tor",
  psiphon_chain: "Psiphon inside WARP",
  tor_chain: "Tor inside WARP",
  psiphon_reverse: "WARP through Psiphon",
  tor_reverse: "WARP through Tor",
};

const NETWORK_MODE_HELP: Record<NetworkMode, string> = {
  warp: "The normal tunnel: your traffic leaves through Cloudflare WARP.",
  psiphon_only:
    "Plain Psiphon, no WARP. Connects in seconds and needs nothing configured — a good first thing to try on a heavily filtered network.",
  tor_only:
    "Plain Tor, no WARP. Bridges are fetched automatically on networks that block Tor. Slower to start.",
  psiphon_chain:
    "Psiphon carried inside the WARP tunnel, so a network that blocks Psiphon never sees it. The Psiphon exit is on 127.0.0.1:1821; 1819 keeps the plain WARP exit.",
  tor_chain:
    "Tor carried inside the WARP tunnel, so a network that blocks Tor never sees it. The Tor exit is on 127.0.0.1:1820; 1819 keeps the plain WARP exit.",
  psiphon_reverse:
    "The tunnel is dialled through Psiphon, so WARP is reached from a Psiphon exit and your network never sees WARP. Runs MASQUE over HTTP/2.",
  tor_reverse:
    "The tunnel is dialled through Tor, so WARP is reached from a Tor exit and your network never sees WARP. Runs MASQUE over HTTP/2.",
};

/** Locked outside Idle/Error like every other profile control. */
export function NetworkModeSelect() {
  const status = useConnectionStore((s) => s.status);
  const mode = useConnectionStore((s) => s.profile.network_mode);
  const setMode = useConnectionStore((s) => s.setNetworkMode);
  const region = useConnectionStore((s) => s.profile.psiphon_region);
  const setRegion = useConnectionStore((s) => s.setPsiphonRegion);
  const locked = status.state !== "Idle" && status.state !== "Error";

  return (
    <div className="flex flex-col gap-2">
      <Select value={mode} onValueChange={(v) => setMode(v as NetworkMode)} disabled={locked}>
        <SelectTrigger
          size="sm"
          className="w-full border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-surface-2"
          aria-label="Network mode"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(LABELS) as NetworkMode[]).map((m) => (
            <SelectItem key={m} value={m}>
              {LABELS[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="px-1 text-[10px] leading-4 text-muted-foreground">{NETWORK_MODE_HELP[mode]}</p>
      {mode.startsWith("psiphon") && (
        <input
          type="text"
          value={region}
          maxLength={2}
          disabled={locked}
          onChange={(e) => setRegion(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
          placeholder="Exit country, e.g. DE (optional)"
          className="h-8 w-full rounded-md bg-black/20 px-2 text-xs text-foreground ring-1 ring-white/10 outline-none focus:ring-primary disabled:opacity-50"
          aria-label="Psiphon exit country"
        />
      )}
    </div>
  );
}
