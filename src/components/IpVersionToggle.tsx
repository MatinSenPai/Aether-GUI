import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useConnectionStore } from "@/state/connectionStore";
import type { IpVersion } from "@/types/connection";

const LABELS: Record<IpVersion, string> = {
  v4: "IPv4",
  v6: "IPv6",
  both: "Both",
};

/**
 * Glass/liquid-glass effect removed — plain CSS border surface instead.
 * Locked outside Idle/Error, mirroring ProtocolSelect.
 */
export function IpVersionToggle() {
  const locked = useConnectionStore((s) => s.status.state !== "Idle" && s.status.state !== "Error");
  const ipVersion = useConnectionStore((s) => s.profile.ip_version);
  const setIpVersion = useConnectionStore((s) => s.setIpVersion);

  return (
    <div className="overflow-hidden rounded-full border border-white/5 bg-black/10">
      <ToggleGroup
        type="single"
        value={ipVersion}
        onValueChange={(v) => {
          if (v) setIpVersion(v as IpVersion);
        }}
        disabled={locked}
        className="w-full gap-0 rounded-full bg-black/20 p-1"
      >
        {(Object.keys(LABELS) as IpVersion[]).map((v) => (
          <ToggleGroupItem
            key={v}
            value={v}
            size="sm"
            aria-label={LABELS[v]}
            className="flex-1 rounded-full text-muted-foreground transition-colors duration-75 data-[state=on]:bg-primary/85 data-[state=on]:text-primary-foreground"
          >
            {LABELS[v]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
