import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useConnectionStore } from "@/state/connectionStore";
import { useLanguage } from "@/i18n/LanguageContext";
import type { IpVersion } from "@/types/connection";

/** Locked outside Idle/Error, mirroring ProtocolSelect. */
export function IpVersionToggle() {
  const status = useConnectionStore((s) => s.status);
  const ipVersion = useConnectionStore((s) => s.profile.ip_version);
  const setIpVersion = useConnectionStore((s) => s.setIpVersion);
  const { t } = useLanguage();

  const locked = status.state !== "Idle" && status.state !== "Error";
  const labels: Record<IpVersion, string> = {
    v4: t.ipVersion.v4,
    v6: t.ipVersion.v6,
    both: t.ipVersion.both,
  };

  return (
    <ToggleGroup
      type="single"
      value={ipVersion}
      onValueChange={(v) => {
        if (v) setIpVersion(v as IpVersion);
      }}
      disabled={locked}
      className="w-full gap-0 rounded-full bg-black/20 p-1 ring-1 ring-white/10"
    >
      {(Object.keys(labels) as IpVersion[]).map((v) => (
        <ToggleGroupItem
          key={v}
          value={v}
          size="sm"
          aria-label={labels[v]}
          className="flex-1 rounded-full text-muted-foreground transition-colors duration-75 data-[state=on]:bg-primary/85 data-[state=on]:text-primary-foreground"
        >
          {labels[v]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
