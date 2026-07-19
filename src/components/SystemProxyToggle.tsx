import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/state/connectionStore";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Independent of the Connect button on purpose: this is the user's standing
 * preference for whether Windows' system proxy should point at the tunnel,
 * not a reflection of the connection itself. Flipping it off while
 * Connected leaves the tunnel running but stops routing system traffic
 * through it; flipping it on while Idle just arms it for the moment a
 * tunnel comes up. Always interactive — never locked to connection state —
 * and mirrored in the tray (checkbox + "Pause/Resume Protection").
 */
export function SystemProxyToggle() {
  const enabled = useConnectionStore((s) => s.systemProxyEnabled);
  const setEnabled = useConnectionStore((s) => s.setSystemProxyEnabled);
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-2 rounded-full bg-surface-2/60 px-3 py-1.5 ring-1 ring-white/10">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {t.systemProxy.label}
        <Tooltip>
          <TooltipTrigger aria-label={t.advanced.about(t.systemProxy.label)}>
            <Info size={12} />
          </TooltipTrigger>
          <TooltipContent>{t.systemProxy.tooltip}</TooltipContent>
        </Tooltip>
      </span>
      <Switch
        checked={enabled ?? false}
        disabled={enabled === null}
        onCheckedChange={(v) => void setEnabled(v)}
        aria-label={t.systemProxy.label}
      />
    </div>
  );
}
