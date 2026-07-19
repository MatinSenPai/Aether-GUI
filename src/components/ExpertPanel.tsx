import { useState } from "react";
import { ChevronDown, FlaskConical, Info } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { FieldRow } from "@/components/AdvancedPanel";
import { NoizeProfileToggle } from "@/components/NoizeProfileToggle";
import { useConnectionStore } from "@/state/connectionStore";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Separate from the Advanced disclosure on purpose, and closed by default
 * even when Advanced is open: these two (`--noize`, `--fragment`) are the
 * settings with the most direct effect on evading active censorship, but
 * they're also the ones most people never need to touch — Aether's own
 * "balanced" noize default and no fragmentation already work for most
 * networks. Future CLI flags with a similarly narrow audience (--peer,
 * --ech, --keepalive, ...) belong here too, not in Advanced.
 */
export function ExpertPanel() {
  const status = useConnectionStore((s) => s.status);
  const masqueHttp2 = useConnectionStore((s) => s.profile.masque_http2);
  const fragmentEnabled = useConnectionStore((s) => s.profile.fragment_enabled);
  const setFragmentEnabled = useConnectionStore((s) => s.setFragmentEnabled);
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const locked = status.state !== "Idle" && status.state !== "Error";
  // --fragment only does anything on the HTTP/2 transport (see
  // profiles.rs::ConnectionProfile::fragment_enabled) — greyed out rather
  // than hidden so switching MASQUE Transport to HTTP/2 later doesn't
  // silently lose a choice the user already made here.
  const fragmentDisabled = locked || !masqueHttp2;

  return (
    <div className="w-full max-w-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary rounded-md">
          <FlaskConical size={14} />
          {t.expert.toggle}
          <ChevronDown
            size={14}
            className="transition-transform duration-150 data-[state=open]:rotate-180"
            data-state={open ? "open" : "closed"}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1 data-[state=open]:duration-150 data-[state=open]:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100">
          <div className="flex flex-col gap-4 pb-2">
            <FieldRow
              label={t.expert.noizeProfile}
              tooltip={t.expert.noizeProfileTooltip}
              aboutLabel={t.advanced.about}
            >
              <NoizeProfileToggle />
            </FieldRow>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {t.expert.fragment}
                <Tooltip>
                  <TooltipTrigger aria-label={t.advanced.about(t.expert.fragment)}>
                    <Info size={12} />
                  </TooltipTrigger>
                  <TooltipContent>{t.expert.fragmentTooltip}</TooltipContent>
                </Tooltip>
              </div>
              <Switch
                checked={fragmentEnabled}
                onCheckedChange={setFragmentEnabled}
                disabled={fragmentDisabled}
                aria-label={t.expert.fragment}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
