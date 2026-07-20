import { Globe, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConnectionStore } from "@/state/connectionStore";

export function TunToggle() {
  const tunEnabled = useConnectionStore((s) => s.tunEnabled);
  const setTunEnabled = useConnectionStore((s) => s.setTunEnabled);
  const status = useConnectionStore((s) => s.status);
  const locked = status.state !== "Idle" && status.state !== "Error";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Globe size={12} />
        System-wide TUN
        <Tooltip>
          <TooltipTrigger aria-label="About System-wide TUN">
            <Info size={12} />
          </TooltipTrigger>
          <TooltipContent>
            Routes all system traffic through the tunnel using sing-box. Requires administrator
            privileges (UAC prompt). When enabled, every application on your device uses the
            tunnel — not just browsers.
          </TooltipContent>
        </Tooltip>
      </div>
      <Switch
        checked={tunEnabled}
        onCheckedChange={setTunEnabled}
        disabled={locked}
        aria-label="System-wide TUN"
      />
    </div>
  );
}
