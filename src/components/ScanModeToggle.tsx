import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/state/connectionStore";
import type { ScanMode } from "@/types/connection";

const LABELS: Record<ScanMode, string> = {
  turbo: "Turbo",
  balanced: "Balanced",
  thorough: "Thorough",
  stealth: "Stealth",
};

const DESCRIPTIONS: Record<ScanMode, string> = {
  turbo:
    "Fastest route discovery, but the most probe traffic — an easier pattern for a censor to notice.",
  balanced: "Good default — reasonable speed without excessive probing.",
  thorough: "Slower, more exhaustive search for working routes.",
  stealth: "Slowest and most cautious — hardest for a censor to fingerprint.",
};

/**
 * Glass/liquid-glass effect removed — plain CSS border surface instead.
 * Locked outside Idle/Error, mirroring ProtocolSelect.
 */
export function ScanModeToggle() {
  const locked = useConnectionStore((s) => s.status.state !== "Idle" && s.status.state !== "Error");
  const scanMode = useConnectionStore((s) => s.profile.scan_mode);
  const setScanMode = useConnectionStore((s) => s.setScanMode);

  return (
    <div className="overflow-hidden rounded-full border border-white/5 bg-black/10">
      <ToggleGroup
        type="single"
        value={scanMode}
        onValueChange={(v) => {
          if (v) setScanMode(v as ScanMode);
        }}
        disabled={locked}
        className="w-full gap-0 rounded-full bg-black/20 p-1"
      >
        {(Object.keys(LABELS) as ScanMode[]).map((mode) => (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <span className="flex-1">
                <ToggleGroupItem
                  value={mode}
                  size="sm"
                  aria-label={LABELS[mode]}
                  className="w-full rounded-full text-muted-foreground transition-colors duration-75 data-[state=on]:bg-primary/85 data-[state=on]:text-primary-foreground"
                >
                  {LABELS[mode]}
                </ToggleGroupItem>
              </span>
            </TooltipTrigger>
            <TooltipContent>{DESCRIPTIONS[mode]}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </div>
  );
}
