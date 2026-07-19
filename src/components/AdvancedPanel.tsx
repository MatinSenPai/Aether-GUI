import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Info, Settings2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { ProtocolSelect } from "@/components/ProtocolSelect";
import { ScanModeToggle } from "@/components/ScanModeToggle";
import { IpVersionToggle } from "@/components/IpVersionToggle";
import { MasqueTransportToggle } from "@/components/MasqueTransportToggle";
import { NoizeProfileToggle } from "@/components/NoizeProfileToggle";
import { useConnectionStore } from "@/state/connectionStore";

function FieldRow({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger aria-label={`About ${label}`}>
              <Info size={12} />
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Collapsed by default — this *is* the auto-mode default: press Connect,
 * done. Everything configurable (the options Aether's own interactive setup
 * exposes — see aether/prompts.rs and profiles.rs, nothing else) plus the
 * raw log stream live behind this one disclosure.
 *
 * Deliberately animation-light: opening used to stack a Motion layout
 * spring, a 300ms tw-animate slide, an instant column reflow, and three
 * Glass filter mounts — four systems fighting read as jank. Now it's one
 * fast CSS fade/slide and nothing else.
 */
export function AdvancedPanel() {
  const logs = useConnectionStore((s) => s.logs);
  const status = useConnectionStore((s) => s.status);
  const quickReconnect = useConnectionStore((s) => s.profile.quick_reconnect);
  const setQuickReconnect = useConnectionStore((s) => s.setQuickReconnect);
  const [open, setOpen] = useState(false);
  // Launch flag — locked mid-session like the other profile controls.
  const locked = status.state !== "Idle" && status.state !== "Error";
  const [autoScroll, setAutoScroll] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="w-full max-w-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary rounded-md">
          <Settings2 size={14} />
          Advanced
          <ChevronDown
            size={14}
            className="transition-transform duration-150 data-[state=open]:rotate-180"
            data-state={open ? "open" : "closed"}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1 data-[state=open]:duration-150 data-[state=open]:[animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100">
          <div className="flex flex-col gap-4 pb-2">
            <FieldRow
              label="Protocol"
              tooltip="MASQUE disguises traffic as normal HTTPS — best against strict censorship. WireGuard is lighter and faster. gool nests two WireGuard tunnels for extra security at a speed cost."
            >
              <ProtocolSelect />
            </FieldRow>
            <FieldRow label="Scan Mode">
              <ScanModeToggle />
            </FieldRow>
            <FieldRow
              label="IP Version"
              tooltip="Which address families to search for working routes. IPv4 is the safest default on most networks."
            >
              <IpVersionToggle />
            </FieldRow>
            <FieldRow
              label="MASQUE Transport"
              tooltip="How the MASQUE tunnel carries traffic. HTTP/3 (QUIC) has the fastest handshake; HTTP/2 (TCP) looks like ordinary HTTPS and works where UDP is blocked or throttled. Only applies to the MASQUE protocol."
            >
              <MasqueTransportToggle />
            </FieldRow>
            <FieldRow
              label="Obfuscation"
              tooltip="Disguises the handshake so DPI can't fingerprint the protocol. Heavier profiles send more decoy traffic — try escalating if the default doesn't connect. Options change based on the selected protocol."
            >
              <NoizeProfileToggle />
            </FieldRow>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Quick reconnect
                <Tooltip>
                  <TooltipTrigger aria-label="About Quick reconnect">
                    <Info size={12} />
                  </TooltipTrigger>
                  <TooltipContent>
                    Remembers the last gateway that worked and re-tests it first on the next
                    connect, skipping the full scan when it still works. Turn off to always scan
                    fresh.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                checked={quickReconnect}
                onCheckedChange={setQuickReconnect}
                disabled={locked}
                aria-label="Quick reconnect"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Logs
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div
              ref={viewportRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
              }}
              className="max-h-64 overflow-y-auto rounded-md bg-black/20 p-2 font-mono text-xs text-muted-foreground ring-1 ring-white/10"
            >
              {logs.length === 0 ? (
                <p className="text-status-idle">No output yet.</p>
              ) : (
                logs.map((l, i) => <p key={i}>{l.line}</p>)
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
