import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnectionStore } from "@/state/connectionStore";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Protocol } from "@/types/connection";

/**
 * Defaults to "Auto" rather than a bare protocol choice: Aether's own
 * scan-mode already performs multi-route discovery internally (confirmed by
 * running the real binary), so protocol selection is a fallback/advanced
 * option here, not the primary decision a user makes every session.
 * Disabled outside Idle/Error since Aether can't switch protocol mid-session
 * — changing it requires a full disconnect/reconnect.
 */
export function ProtocolSelect() {
  const status = useConnectionStore((s) => s.status);
  const protocol = useConnectionStore((s) => s.profile.protocol);
  const setProtocol = useConnectionStore((s) => s.setProtocol);
  const { t } = useLanguage();

  const locked = status.state !== "Idle" && status.state !== "Error";
  const labels: Record<Protocol, string> = {
    auto: t.protocol.auto,
    masque: t.protocol.masque,
    wireguard: t.protocol.wireguard,
    gool: t.protocol.gool,
  };

  return (
    <Select
      value={protocol}
      onValueChange={(v) => setProtocol(v as Protocol)}
      disabled={locked}
    >
      <SelectTrigger
        size="sm"
        className="w-full border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-surface-2"
        aria-label={t.advanced.protocol}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(labels) as Protocol[]).map((p) => (
          <SelectItem key={p} value={p}>
            {labels[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
