import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useConnectionStore } from "@/state/connectionStore";
import type { IpVersion } from "@/types/connection";

const LABELS: Record<IpVersion, string> = {
  v4: "IPv4",
  v6: "IPv6",
  both: "Both",
};

/** Locked outside Idle/Error, mirroring ProtocolSelect. */
export function IpVersionToggle() {
  const status = useConnectionStore((s) => s.status);
  const ipVersion = useConnectionStore((s) => s.profile.ip_version);
  const setIpVersion = useConnectionStore((s) => s.setIpVersion);

  const locked = status.state !== "Idle" && status.state !== "Error";

  return (
    <ToggleGroup
      type="single"
      value={ipVersion}
      onValueChange={(v) => {
        if (v) setIpVersion(v as IpVersion);
      }}
      disabled={locked}
      className="w-full gap-0 rounded-full bg-surface-2 p-1"
    >
      {(Object.keys(LABELS) as IpVersion[]).map((v) => (
        <ToggleGroupItem
          key={v}
          value={v}
          size="sm"
          aria-label={LABELS[v]}
          className="flex-1 rounded-full text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {LABELS[v]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
