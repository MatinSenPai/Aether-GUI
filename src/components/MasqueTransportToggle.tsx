import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/state/connectionStore";
import { useLanguage } from "@/i18n/LanguageContext";

type Transport = "http3" | "http2";

/** Aether ≥1.2.0's MASQUE-only transport choice. Locked outside Idle/Error
 * like every other profile control, and additionally disabled when the
 * selected protocol can't use it (WireGuard / gool). */
export function MasqueTransportToggle() {
  const status = useConnectionStore((s) => s.status);
  const protocol = useConnectionStore((s) => s.profile.protocol);
  const masqueHttp2 = useConnectionStore((s) => s.profile.masque_http2);
  const setMasqueHttp2 = useConnectionStore((s) => s.setMasqueHttp2);
  const { t } = useLanguage();

  const locked = status.state !== "Idle" && status.state !== "Error";
  const notMasque = protocol === "wireguard" || protocol === "gool";
  const labels: Record<Transport, string> = {
    http3: t.masqueTransport.http3,
    http2: t.masqueTransport.http2,
  };
  const descriptions: Record<Transport, string> = {
    http3: t.masqueTransport.http3Desc,
    http2: t.masqueTransport.http2Desc,
  };

  return (
    <ToggleGroup
      type="single"
      value={masqueHttp2 ? "http2" : "http3"}
      onValueChange={(v) => {
        if (v) setMasqueHttp2(v === "http2");
      }}
      disabled={locked || notMasque}
      className="w-full gap-0 rounded-full bg-black/20 p-1 ring-1 ring-white/10"
    >
      {(Object.keys(labels) as Transport[]).map((tr) => (
        <Tooltip key={tr}>
          {/* asChild targets this plain span, not ToggleGroupItem directly —
           * Radix's Slot cloning onto ToggleGroupItem's own internals was
           * silently breaking its data-state/pressed rendering. */}
          <TooltipTrigger asChild>
            <span className="flex-1">
              <ToggleGroupItem
                value={tr}
                size="sm"
                aria-label={labels[tr]}
                className="w-full rounded-full text-muted-foreground transition-colors duration-75 data-[state=on]:bg-primary/85 data-[state=on]:text-primary-foreground"
              >
                {labels[tr]}
              </ToggleGroupItem>
            </span>
          </TooltipTrigger>
          <TooltipContent>{descriptions[tr]}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
