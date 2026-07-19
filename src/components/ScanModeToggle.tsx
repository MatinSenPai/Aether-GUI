import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/state/connectionStore";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ScanMode } from "@/types/connection";

/** Locked outside Idle/Error, mirroring ProtocolSelect — scan mode can't
 * change mid-session either. */
export function ScanModeToggle() {
  const status = useConnectionStore((s) => s.status);
  const scanMode = useConnectionStore((s) => s.profile.scan_mode);
  const setScanMode = useConnectionStore((s) => s.setScanMode);
  const { t } = useLanguage();

  const locked = status.state !== "Idle" && status.state !== "Error";
  const labels: Record<ScanMode, string> = {
    turbo: t.scanMode.turbo,
    balanced: t.scanMode.balanced,
    thorough: t.scanMode.thorough,
    stealth: t.scanMode.stealth,
  };
  const descriptions: Record<ScanMode, string> = {
    turbo: t.scanMode.turboDesc,
    balanced: t.scanMode.balancedDesc,
    thorough: t.scanMode.thoroughDesc,
    stealth: t.scanMode.stealthDesc,
  };

  return (
    <ToggleGroup
      type="single"
      value={scanMode}
      onValueChange={(v) => {
        if (v) setScanMode(v as ScanMode);
      }}
      disabled={locked}
      className="w-full gap-0 rounded-full bg-black/20 p-1 ring-1 ring-white/10"
    >
      {(Object.keys(labels) as ScanMode[]).map((mode) => (
        <Tooltip key={mode}>
          {/* asChild targets this plain span, not ToggleGroupItem directly —
           * Radix's Slot cloning onto ToggleGroupItem's own internals was
           * silently breaking its data-state/pressed rendering. */}
          <TooltipTrigger asChild>
            <span className="flex-1">
              <ToggleGroupItem
                value={mode}
                size="sm"
                aria-label={labels[mode]}
                className="w-full rounded-full text-muted-foreground transition-colors duration-75 data-[state=on]:bg-primary/85 data-[state=on]:text-primary-foreground"
              >
                {labels[mode]}
              </ToggleGroupItem>
            </span>
          </TooltipTrigger>
          <TooltipContent>{descriptions[mode]}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
