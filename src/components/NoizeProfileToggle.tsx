import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/state/connectionStore";
import type { MasqueNoize, WgNoize } from "@/types/connection";

const MASQUE_LABELS: Record<MasqueNoize, string> = {
  firewall: "Firewall",
  gfw: "GFW",
  off: "Off",
};

const MASQUE_DESCRIPTIONS: Record<MasqueNoize, string> = {
  firewall:
    "Balanced obfuscation — gets through most filtered networks without much speed cost. Recommended default.",
  gfw:
    "Heavier obfuscation with more decoy traffic. Try this when Firewall can't get through.",
  off: "No obfuscation. Only for open networks or testing.",
};

const WG_LABELS: Record<WgNoize, string> = {
  balanced: "Balanced",
  aggressive: "Aggressive",
  light: "Light",
  off: "Off",
};

const WG_DESCRIPTIONS: Record<WgNoize, string> = {
  balanced:
    "Default — a good balance between stealth and speed for WireGuard traffic.",
  aggressive:
    "Heaviest obfuscation with the most decoy packets. For very strict networks.",
  light: "Minimal obfuscation with the least overhead.",
  off: "No obfuscation. Only for open networks or testing.",
};

/** Shows MASQUE or WireGuard/gool obfuscation profiles based on the selected
 * protocol. Locked outside Idle/Error like every other profile control. */
export function NoizeProfileToggle() {
  const status = useConnectionStore((s) => s.status);
  const protocol = useConnectionStore((s) => s.profile.protocol);
  const masqueNoize = useConnectionStore((s) => s.profile.masque_noize);
  const wgNoize = useConnectionStore((s) => s.profile.wg_noize);
  const setMasqueNoize = useConnectionStore((s) => s.setMasqueNoize);
  const setWgNoize = useConnectionStore((s) => s.setWgNoize);

  const locked = status.state !== "Idle" && status.state !== "Error";
  const isMasque = protocol === "auto" || protocol === "masque";

  if (isMasque) {
    return (
      <ToggleGroup
        type="single"
        value={masqueNoize}
        onValueChange={(v) => {
          if (v) setMasqueNoize(v as MasqueNoize);
        }}
        disabled={locked}
        className="w-full gap-0 rounded-full bg-black/20 p-1 ring-1 ring-white/10"
      >
        {(Object.keys(MASQUE_LABELS) as MasqueNoize[]).map((n) => (
          <Tooltip key={n}>
            <TooltipTrigger asChild>
              <span className="flex-1">
                <ToggleGroupItem
                  value={n}
                  size="sm"
                  aria-label={MASQUE_LABELS[n]}
                  className="w-full rounded-full text-muted-foreground transition-colors duration-75 data-[state=on]:bg-primary/85 data-[state=on]:text-primary-foreground"
                >
                  {MASQUE_LABELS[n]}
                </ToggleGroupItem>
              </span>
            </TooltipTrigger>
            <TooltipContent>{MASQUE_DESCRIPTIONS[n]}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    );
  }

  return (
    <ToggleGroup
      type="single"
      value={wgNoize}
      onValueChange={(v) => {
        if (v) setWgNoize(v as WgNoize);
      }}
      disabled={locked}
      className="w-full gap-0 rounded-full bg-black/20 p-1 ring-1 ring-white/10"
    >
      {(Object.keys(WG_LABELS) as WgNoize[]).map((n) => (
        <Tooltip key={n}>
          <TooltipTrigger asChild>
            <span className="flex-1">
              <ToggleGroupItem
                value={n}
                size="sm"
                aria-label={WG_LABELS[n]}
                className="w-full rounded-full text-muted-foreground transition-colors duration-75 data-[state=on]:bg-primary/85 data-[state=on]:text-primary-foreground"
              >
                {WG_LABELS[n]}
              </ToggleGroupItem>
            </span>
          </TooltipTrigger>
          <TooltipContent>{WG_DESCRIPTIONS[n]}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
