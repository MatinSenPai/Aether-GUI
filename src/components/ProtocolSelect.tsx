import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnectionStore } from "@/state/connectionStore";
import type { Protocol } from "@/types/connection";

const LABELS: Record<Protocol, string> = {
  auto: "Auto (recommended)",
  masque: "MASQUE",
  wireguard: "WireGuard",
  gool: "WARP-in-WARP (gool)",
};

/**
 * Defaults to "Auto" rather than a bare protocol choice: Aether's own
 * scan-mode already performs multi-route discovery internally (confirmed by
 * running the real binary), so protocol selection is a fallback/advanced
 * option here, not the primary decision a user makes every session.
 * Disabled outside Idle/Error since Aether can't switch protocol mid-session
 * — changing it requires a full disconnect/reconnect.
 */
export function ProtocolSelect() {
  const locked = useConnectionStore((s) => s.status.state !== "Idle" && s.status.state !== "Error");
  const protocol = useConnectionStore((s) => s.profile.protocol);
  const setProtocol = useConnectionStore((s) => s.setProtocol);

  return (
    <Select
      value={protocol}
      onValueChange={(v) => setProtocol(v as Protocol)}
      disabled={locked}
    >
      <SelectTrigger
        size="sm"
        className="w-full border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-surface-2"
        aria-label="Protocol"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(LABELS) as Protocol[]).map((p) => (
          <SelectItem key={p} value={p}>
            {LABELS[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
