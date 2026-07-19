import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/state/connectionStore";
import { useLanguage } from "@/i18n/LanguageContext";
import type { NoizeProfile } from "@/types/connection";

/** Locked outside Idle/Error, mirroring the rest of the profile controls. */
export function NoizeProfileToggle() {
  const status = useConnectionStore((s) => s.status);
  const noizeProfile = useConnectionStore((s) => s.profile.noize_profile);
  const setNoizeProfile = useConnectionStore((s) => s.setNoizeProfile);
  const { t } = useLanguage();

  const locked = status.state !== "Idle" && status.state !== "Error";
  const labels: Record<NoizeProfile, string> = {
    off: t.noizeProfile.off,
    light: t.noizeProfile.light,
    balanced: t.noizeProfile.balanced,
    aggressive: t.noizeProfile.aggressive,
  };
  const descriptions: Record<NoizeProfile, string> = {
    off: t.noizeProfile.offDesc,
    light: t.noizeProfile.lightDesc,
    balanced: t.noizeProfile.balancedDesc,
    aggressive: t.noizeProfile.aggressiveDesc,
  };

  return (
    <ToggleGroup
      type="single"
      value={noizeProfile}
      onValueChange={(v) => {
        if (v) setNoizeProfile(v as NoizeProfile);
      }}
      disabled={locked}
      className="w-full gap-0 rounded-full bg-black/20 p-1 ring-1 ring-white/10"
    >
      {(Object.keys(labels) as NoizeProfile[]).map((profile) => (
        <Tooltip key={profile}>
          <TooltipTrigger asChild>
            <span className="flex-1">
              <ToggleGroupItem
                value={profile}
                size="sm"
                aria-label={labels[profile]}
                className="w-full rounded-full text-muted-foreground transition-colors duration-75 data-[state=on]:bg-primary/85 data-[state=on]:text-primary-foreground"
              >
                {labels[profile]}
              </ToggleGroupItem>
            </span>
          </TooltipTrigger>
          <TooltipContent>{descriptions[profile]}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}
